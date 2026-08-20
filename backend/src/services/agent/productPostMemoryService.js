const { db } = require('../../config/firebase');
const { normalizeMetrics, calculateDecomposedScores } = require('./metricsCalculator');

/**
 * Mencatat postingan baru ke dalam Buku Besar Memori (product_post_memory)
 * @param {Object} memoryData
 * @returns {Promise<Object>}
 */
async function recordPostMemory(memoryData) {
  try {
    const {
      product_id,
      post_id,
      experiment_id = null,
      variant_id = 'A',
      quarter = getCurrentQuarter(),
      objective = 'clicks',
      user_id = 'system',
      context_at_post = {},
      raw_metrics = {},
      published_at = new Date().toISOString(),
    } = memoryData;

    const memoryId = post_id ? `mem_${post_id}` : `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const docRef = db.collection('product_post_memory').doc(memoryId);

    const normalized = normalizeMetrics(raw_metrics);
    const scores = calculateDecomposedScores(normalized, objective);

    const payload = {
      id: memoryId,
      post_id: post_id || null,
      product_id: String(product_id),
      user_id: String(user_id),
      experiment_id: experiment_id || null,
      variant_id: String(variant_id || 'A'),
      quarter: String(quarter),
      objective: String(objective),
      context_at_post: {
        platform: context_at_post.platform || 'facebook',
        account_id: context_at_post.account_id || '',
        account_name: context_at_post.account_name || '',
        shortlink_code: context_at_post.shortlink_code || '',
        target_audience: context_at_post.target_audience || 'Umum',
        price_at_post: Number(context_at_post.price_at_post) || 0,
        original_price_at_post: Number(context_at_post.original_price_at_post) || null,
        discount_at_post: context_at_post.discount_at_post || '',
        posting_hour: Number(context_at_post.posting_hour ?? new Date().getHours()),
        posting_day: context_at_post.posting_day || getDayName(new Date()),
        hook_type: context_at_post.hook_type || 'general',
        copy_angle: context_at_post.copy_angle || 'Standard',
        template_id: context_at_post.template_id || '',
        template_name: context_at_post.template_name || '',
        media_type: context_at_post.media_type || 'image',
        media_urls: Array.isArray(context_at_post.media_urls) ? context_at_post.media_urls : [],
        content_fingerprint: context_at_post.content_fingerprint || '',
      },
      published_at: published_at,
      last_synced_at: new Date().toISOString(),
      raw_metrics: {
        views: normalized.views,
        reach: normalized.views,
        likes: normalized.likes,
        comments: normalized.comments,
        shares: normalized.shares,
        saves: normalized.saves,
        affiliate_clicks: normalized.affiliate_clicks,
      },
      normalized_metrics: normalized,
      scores: scores,
      created_at: new Date().toISOString(),
    };

    await docRef.set(payload);

    // Update Product's internal quick references in affiliate_products
    await updateProductQuarterlySnapshot(product_id, quarter, user_id);

    // Tandai media yang telah digunakan pada platform ini
    if (product_id && payload.context_at_post?.media_urls?.length > 0 && payload.context_at_post?.platform) {
      const { markMediaUsedOnPlatform } = require('./mediaEvaluatorService');
      await markMediaUsedOnPlatform(product_id, payload.context_at_post.media_urls, payload.context_at_post.platform, user_id);
    }

    return payload;
  } catch (err) {
    console.error('[recordPostMemory Error]:', err.message);
    throw err;
  }
}

/**
 * Sinkronisasi metrik terbaru dari post_analytics dan link_clicks ke dalam memory
 * @param {string} postId - ID Postingan
 * @param {Object} updatedRawMetrics - Metrik baru yang didapat dari Meta / Link Tracker
 * @param {Object} [fallbackContext] - Informasi tambahan jika memory belum dibuat sebelumnya
 */
async function syncPostMemoryMetrics(postId, updatedRawMetrics = {}, fallbackContext = null) {
  try {
    const memoryId = `mem_${postId}`;
    let docRef = db.collection('product_post_memory').doc(memoryId);
    let doc = await docRef.get();

    let data = null;

    if (!doc.exists) {
      // Coba cari berdasarkan post_id
      const querySnap = await db.collection('product_post_memory')
        .where('post_id', '==', postId)
        .limit(1)
        .get();

      if (!querySnap.empty) {
        doc = querySnap.docs[0];
        docRef = doc.ref;
        data = doc.data();
      } else if (fallbackContext && fallbackContext.product_id) {
        // Buat entri memori baru otomatis jika belum ada (misal post dari Composer / Meta langsung)
        const quarter = fallbackContext.quarter || getCurrentQuarter();
        const obj = fallbackContext.objective || 'clicks';
        const norm = normalizeMetrics(updatedRawMetrics);
        const sc = calculateDecomposedScores(norm, obj);
        
        const newPayload = {
          id: memoryId,
          post_id: postId,
          product_id: String(fallbackContext.product_id),
          user_id: String(fallbackContext.user_id || 'system'),
          experiment_id: fallbackContext.experiment_id || null,
          variant_id: fallbackContext.variant_id || 'A',
          quarter: String(quarter),
          objective: obj,
          context_at_post: {
            platform: fallbackContext.platform || 'facebook',
            account_id: fallbackContext.account_id || '',
            account_name: fallbackContext.account_name || '',
            shortlink_code: fallbackContext.shortlink_code || '',
            target_audience: fallbackContext.target_audience || 'Umum',
            price_at_post: Number(fallbackContext.price_at_post) || 0,
            original_price_at_post: Number(fallbackContext.original_price_at_post) || null,
            discount_at_post: fallbackContext.discount_at_post || '',
            posting_hour: Number(fallbackContext.posting_hour ?? new Date().getHours()),
            posting_day: fallbackContext.posting_day || getDayName(new Date()),
            hook_type: fallbackContext.hook_type || 'general',
            copy_angle: fallbackContext.copy_angle || 'Standard',
            template_id: fallbackContext.template_id || '',
            template_name: fallbackContext.template_name || '',
            media_type: fallbackContext.media_type || 'image',
            media_urls: Array.isArray(fallbackContext.media_urls) ? fallbackContext.media_urls : [],
            content_fingerprint: fallbackContext.content_fingerprint || '',
          },
          published_at: fallbackContext.published_at || new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          raw_metrics: updatedRawMetrics,
          normalized_metrics: norm,
          scores: sc,
          created_at: new Date().toISOString(),
        };

        await docRef.set(newPayload);
        await updateProductQuarterlySnapshot(fallbackContext.product_id, quarter, fallbackContext.user_id || 'system');
        return newPayload;
      } else {
        return null;
      }
    } else {
      data = doc.data();
    }

    const mergedRaw = {
      ...data.raw_metrics,
      ...updatedRawMetrics,
    };

    const normalized = normalizeMetrics(mergedRaw);
    const scores = calculateDecomposedScores(normalized, data.objective || 'clicks');

    const updatePayload = {
      raw_metrics: mergedRaw,
      normalized_metrics: normalized,
      scores: scores,
      last_synced_at: new Date().toISOString(),
    };

    await docRef.update(updatePayload);

    // Refresh product's quarterly snapshot
    if (data.product_id && data.quarter) {
      await updateProductQuarterlySnapshot(data.product_id, data.quarter, data.user_id);
    }

    return { id: docRef.id, ...data, ...updatePayload };
  } catch (err) {
    console.error('[syncPostMemoryMetrics Error]:', err.message);
    return null;
  }
}

/**
 * Mengambil seluruh riwayat postingan suatu produk
 * @param {string} productId
 * @param {number} limit
 */
async function getProductPostHistory(productId, limit = 50) {
  try {
    const snap = await db.collection('product_post_memory')
      .where('product_id', '==', productId)
      .get();

    let list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    list.sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0));
    return list.slice(0, limit);
  } catch (err) {
    console.error('[getProductPostHistory Error]:', err.message);
    return [];
  }
}

/**
 * Mengambil postingan terakhir pada platform tertentu untuk cek sidik jari & cooldown
 * @param {string} userId
 * @param {string} platform
 * @param {number} daysLimit - rentang hari (default 7 hari)
 */
async function getRecentPlatformPosts(userId, platform, daysLimit = 7) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysLimit);
    const cutoffIso = cutoffDate.toISOString();

    const snap = await db.collection('product_post_memory')
      .where('user_id', '==', userId)
      .where('context_at_post.platform', '==', platform)
      .get();

    let list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    list = list.filter(item => item.published_at >= cutoffIso);
    return list;
  } catch (err) {
    console.error('[getRecentPlatformPosts Error]:', err.message);
    return [];
  }
}

/**
 * Menghitung akumulasi statistik produk di kuartal berjalan dan mengupdate dokumen produk
 * @param {string} productId
 * @param {string} quarter
 * @param {string} userId
 */
async function updateProductQuarterlySnapshot(productId, quarter, userId) {
  try {
    const snap = await db.collection('product_post_memory')
      .where('product_id', '==', productId)
      .where('quarter', '==', quarter)
      .get();

    const posts = snap.docs.map(d => d.data());
    const attemptsCount = posts.length;

    let totalViews = 0;
    let totalClicks = 0;
    let totalScore = 0;
    let bestScore = 0;
    let bestTemplateId = null;

    posts.forEach(p => {
      const views = p.raw_metrics?.views || 0;
      const clicks = p.raw_metrics?.affiliate_clicks || 0;
      const score = p.scores?.overall_score || 0;

      totalViews += views;
      totalClicks += clicks;
      totalScore += score;

      if (score > bestScore) {
        bestScore = score;
        bestTemplateId = p.context_at_post?.template_id || null;
      }
    });

    const avgScore = attemptsCount > 0 ? Number((totalScore / attemptsCount).toFixed(1)) : 0;
    const avgCtr = totalViews > 0 ? Number(((totalClicks / totalViews) * 100).toFixed(2)) : 0;

    const prodRef = db.collection('affiliate_products').doc(productId);
    const prodDoc = await prodRef.get();

    if (prodDoc.exists) {
      const existing = prodDoc.data();
      const existingStatus = existing.quarterly_status?.status || existing.lifecycle_status || 'NEW';

      // Update lifecycle status if currently testing
      let newLifecycle = existing.lifecycle_status || 'NEW';
      if (attemptsCount === 0) {
        newLifecycle = 'NEW';
      } else if (attemptsCount > 0 && attemptsCount < 3) {
        newLifecycle = 'TESTING';
      } else if (attemptsCount >= 3) {
        if (avgCtr >= 2.5 && totalClicks >= 30) {
          newLifecycle = 'PROVEN';
        } else if (avgCtr >= 1.5 || totalClicks >= 15) {
          newLifecycle = 'PROMISING';
        }
      }

      await prodRef.update({
        lifecycle_status: newLifecycle,
        quarterly_summary: {
          current_quarter: quarter,
          total_attempts: attemptsCount,
          total_views: totalViews,
          total_clicks: totalClicks,
          avg_ctr_percent: avgCtr,
          avg_score: avgScore,
          best_score: bestScore,
          best_template_id: bestTemplateId,
          last_tested_at: posts[posts.length - 1]?.published_at || null,
          updated_at: new Date().toISOString()
        }
      });
    }
  } catch (err) {
    console.error('[updateProductQuarterlySnapshot Error]:', err.message);
  }
}

// Helpers
function getCurrentQuarter(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const q = Math.ceil(month / 3);
  return `${year}-Q${q}`;
}

function getDayName(date = new Date()) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

module.exports = {
  recordPostMemory,
  syncPostMemoryMetrics,
  getProductPostHistory,
  getRecentPlatformPosts,
  updateProductQuarterlySnapshot,
  getCurrentQuarter,
};
