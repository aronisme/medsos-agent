const { db } = require('../../../config/firebase');

const SEARCH_POLICY = {
  observedLimit: 500,
  rollingWindowDays: 7,
};

/**
 * Mengambil daftar kata kunci yang siap dicari pada siklus ini
 * @param {string} userId 
 * @param {number} [maxBatch=3] - Maksimal kata kunci per siklus untuk hemat kuota
 */
async function getNextKeywordsForSearch(userId, maxBatch = 3) {
  try {
    const snap = await db.collection('threads_monitoring_keywords')
      .where('user_id', '==', userId)
      .where('is_active', '==', true)
      .get();

    if (snap.empty) {
      // Default initial keywords if none exist
      return [
        { id: 'def_1', keyword: 'rekomendasi shopee', priority: 1 },
        { id: 'def_2', keyword: 'racun shopee', priority: 1 },
      ];
    }

    const keywords = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Urutkan berdasarkan waktu terakhir dicari (yang terlama dulu)
    keywords.sort((a, b) => new Date(a.last_searched_at || 0) - new Date(b.last_searched_at || 0));

    return keywords.slice(0, maxBatch);
  } catch (err) {
    console.warn('[SearchScheduler] Warning getting keywords:', err.message);
    return [{ id: 'def_1', keyword: 'rekomendasi shopee', priority: 1 }];
  }
}

/**
 * Memperbarui timestamp pencarian kata kunci
 */
async function markKeywordSearched(keywordId) {
  if (!keywordId || keywordId.startsWith('def_')) return;
  try {
    await db.collection('threads_monitoring_keywords').doc(keywordId).update({
      last_searched_at: new Date().toISOString(),
    });
  } catch (_) {}
}

module.exports = {
  getNextKeywordsForSearch,
  markKeywordSearched,
  SEARCH_POLICY,
};
