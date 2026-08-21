const { db } = require('../../../config/firebase');

/**
 * Menganalisis seluruh observasi mentah kompetitor untuk menghasilkan insight pola konten
 * @param {string} profileId 
 */
async function aggregateCompetitorInsights(profileId) {
  try {
    const snap = await db.collection('threads_competitor_observations')
      .where('profile_id', '==', profileId)
      .get();

    if (snap.empty) {
      return {
        topHooks: [],
        avgFrequency: '0 posts/day',
        mediaBreakdown: {},
        totalObserved: 0,
      };
    }

    const observations = snap.docs.map(d => d.data());
    const topHooks = [];
    const mediaBreakdown = {};

    observations.forEach(o => {
      if (o.extracted_hook && !topHooks.includes(o.extracted_hook)) {
        topHooks.push(o.extracted_hook);
      }
      const mt = o.media_type || 'TEXT_POST';
      mediaBreakdown[mt] = (mediaBreakdown[mt] || 0) + 1;
    });

    return {
      topHooks: topHooks.slice(0, 5),
      avgFrequency: `${Math.max(1, Math.round(observations.length / 7))} posts/minggu`,
      mediaBreakdown,
      totalObserved: observations.length,
      lastAnalyzedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[InsightAggregator] Error aggregating insights for ${profileId}:`, err.message);
    return null;
  }
}

module.exports = {
  aggregateCompetitorInsights,
};
