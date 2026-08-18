const { db } = require('../../config/firebase');
const { evaluateABExperiment } = require('./metricsCalculator');
const { logAgentDecision } = require('./decisionLogger');

/**
 * Membuat eksperimen A/B baru
 * @param {Object} opts
 * @param {string} opts.productId
 * @param {string} opts.quarter
 * @param {string} opts.hypothesis
 * @param {string} [opts.objective] - 'clicks' | 'engagement' | 'conversion'
 * @param {Array} opts.variants - initial variant objects [{ variant_id: 'A', template_id, media_type, ... }]
 * @param {string} opts.userId
 */
async function createExperiment({
  productId,
  quarter,
  hypothesis,
  objective = 'clicks',
  variants = [],
  userId = 'system'
}) {
  try {
    const expId = `EXP-${quarter}-${Date.now().toString(36).toUpperCase()}`;
    const docRef = db.collection('experiments').doc(expId);

    const payload = {
      id: expId,
      product_id: String(productId),
      user_id: String(userId),
      quarter: String(quarter),
      hypothesis: String(hypothesis),
      objective: String(objective),
      status: 'running', // 'running' | 'completed' | 'inconclusive'
      variants: variants.map((v, i) => ({
        variant_id: v.variant_id || (i === 0 ? 'A' : 'B'),
        post_id: v.post_id || null,
        template_id: v.template_id || '',
        template_name: v.template_name || '',
        copy_angle: v.copy_angle || '',
        media_type: v.media_type || 'image',
        media_urls: v.media_urls || [],
        sample_views: 0,
        clicks: 0,
        ctr: 0.0,
      })),
      metrics_summary: {
        winner_variant: null,
        relative_lift: null,
        confidence_level: 'preliminary',
        sample_size_total: 0,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await docRef.set(payload);

    await logAgentDecision({
      userId,
      decisionType: 'EXPERIMENT_EVALUATION',
      productId,
      experimentId: expId,
      summary: `Memulai Eksperimen A/B Baru #${expId}`,
      reasoning: `Hipotesis: ${hypothesis} (Objective: ${objective})`,
      metadata: { variant_count: variants.length }
    });

    return payload;
  } catch (err) {
    console.error('[createExperiment Error]:', err.message);
    throw err;
  }
}

/**
 * Menambahkan atau mengaitkan post_id ke salah satu variant eksperimen
 * @param {string} expId 
 * @param {string} variantId 
 * @param {string} postId 
 */
async function attachPostToExperiment(expId, variantId, postId) {
  try {
    const docRef = db.collection('experiments').doc(expId);
    const doc = await docRef.get();
    if (!doc.exists) return null;

    const data = doc.data();
    const variants = (data.variants || []).map(v => {
      if (v.variant_id === variantId) {
        return { ...v, post_id: postId };
      }
      return v;
    });

    await docRef.update({
      variants,
      updated_at: new Date().toISOString()
    });

    return { id: expId, ...data, variants };
  } catch (err) {
    console.error('[attachPostToExperiment Error]:', err.message);
    return null;
  }
}

/**
 * Mengevaluasi eksperimen A/B yang sedang berjalan dengan membaca metrik terbaru variannya
 * @param {string} expId 
 */
async function evaluateExperiment(expId) {
  try {
    const docRef = db.collection('experiments').doc(expId);
    const doc = await docRef.get();
    if (!doc.exists) return null;

    const exp = doc.data();
    if (!Array.isArray(exp.variants) || exp.variants.length < 2) {
      return exp;
    }

    const updatedVariants = [];
    for (const v of exp.variants) {
      if (v.post_id) {
        // Ambil metrik dari product_post_memory
        const memDoc = await db.collection('product_post_memory').doc(`mem_${v.post_id}`).get();
        if (memDoc.exists) {
          const mem = memDoc.data();
          const views = mem.raw_metrics?.views || 0;
          const clicks = mem.raw_metrics?.affiliate_clicks || 0;
          const ctr = views > 0 ? Number((clicks / views).toFixed(4)) : 0;

          updatedVariants.push({
            ...v,
            sample_views: views,
            clicks: clicks,
            ctr: ctr,
          });
          continue;
        }
      }
      updatedVariants.push(v);
    }

    const varA = updatedVariants.find(v => v.variant_id === 'A') || updatedVariants[0];
    const varB = updatedVariants.find(v => v.variant_id === 'B') || updatedVariants[1];

    const stats = evaluateABExperiment(
      { views: varA.sample_views, clicks: varA.clicks },
      { views: varB.sample_views, clicks: varB.clicks }
    );

    let newStatus = exp.status;
    if (stats.sample_size_total >= 1000 && stats.confidence_level !== 'preliminary') {
      newStatus = 'completed';
    }

    const updatePayload = {
      variants: updatedVariants,
      status: newStatus,
      metrics_summary: stats,
      updated_at: new Date().toISOString()
    };

    await docRef.update(updatePayload);

    // Jika sudah ada pemenang dengan medium/high confidence, catat keputusan
    if (stats.confidence_level !== 'preliminary' && stats.winner_variant !== 'TIE') {
      await logAgentDecision({
        userId: exp.user_id || 'system',
        decisionType: 'EXPERIMENT_EVALUATION',
        productId: exp.product_id,
        experimentId: expId,
        summary: `Eksperimen Selesai: Varian ${stats.winner_variant} Menang (${stats.relative_lift})`,
        reasoning: `Berdasarkan ${stats.sample_size_total} sampel tayangan, Varian ${stats.winner_variant} menghasilkan CTR lebih tinggi dengan tingkat keyakinan ${stats.confidence_level}.`,
        metadata: stats
      });
    }

    return { id: expId, ...exp, ...updatePayload };
  } catch (err) {
    console.error('[evaluateExperiment Error]:', err.message);
    return null;
  }
}

/**
 * Mengambil daftar semua eksperimen untuk user / kuartal tertentu
 * @param {string} userId 
 * @param {string} [quarter] 
 */
async function getExperiments(userId, quarter) {
  try {
    let query = db.collection('experiments')
      .where('user_id', '==', userId);

    if (quarter) {
      query = query.where('quarter', '==', quarter);
    }

    const snap = await query.get();
    let list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return list;
  } catch (err) {
    console.error('[getExperiments Error]:', err.message);
    return [];
  }
}

module.exports = {
  createExperiment,
  attachPostToExperiment,
  evaluateExperiment,
  getExperiments,
};
