const { db } = require('../../config/firebase');

/**
 * Log keputusan AI dengan transparansi penuh
 * @param {Object} opts
 * @param {string} opts.userId - ID User pemilik
 * @param {string} opts.decisionType - 'MEDIA_SELECTION' | 'TEMPLATE_MATCH' | 'DIAGNOSTIC_ANALYSIS' | 'QUARTER_LIFECYCLE' | 'EXPERIMENT_EVALUATION' | 'SCHEDULE_DISPATCH'
 * @param {string} opts.productId - ID Produk Shopee
 * @param {string} [opts.experimentId] - ID Eksperimen (jika ada)
 * @param {string} [opts.postId] - ID Postingan (jika ada)
 * @param {string} opts.summary - Ringkasan keputusan singkat
 * @param {string} opts.reasoning - Penjelasan mendalam kenapa keputusan diambil
 * @param {Object} [opts.metadata] - Data pendukung (skor, perbandingan, alternatif yang ditolak)
 */
async function logAgentDecision({
  userId = 'system',
  decisionType,
  productId = '',
  experimentId = null,
  postId = null,
  summary,
  reasoning,
  metadata = {}
}) {
  try {
    const docRef = db.collection('agent_decisions_log').doc();
    const payload = {
      id: docRef.id,
      user_id: userId,
      decision_type: decisionType,
      product_id: productId,
      experiment_id: experimentId,
      post_id: postId,
      summary: String(summary || ''),
      reasoning: String(reasoning || ''),
      metadata: metadata || {},
      created_at: new Date().toISOString()
    };

    await docRef.set(payload);
    return payload;
  } catch (err) {
    console.error('[logAgentDecision Error]:', err.message);
    return null;
  }
}

/**
 * Mengambil riwayat keputusan agen untuk produk tertentu
 * @param {string} userId 
 * @param {string} productId 
 * @param {number} limit 
 */
async function getProductDecisions(userId, productId, limit = 20) {
  try {
    let query = db.collection('agent_decisions_log')
      .where('user_id', '==', userId);

    if (productId) {
      query = query.where('product_id', '==', productId);
    }

    const snapshot = await query.get();
    let logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    logs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return logs.slice(0, limit);
  } catch (err) {
    console.error('[getProductDecisions Error]:', err.message);
    return [];
  }
}

module.exports = {
  logAgentDecision,
  getProductDecisions,
};
