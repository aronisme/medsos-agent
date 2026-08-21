const { db } = require('../../../config/firebase');
const { searchPosts } = require('../api/threadsSearchApi');
const { recordCompetitorPost } = require('./observationService');
const { aggregateCompetitorInsights } = require('./insightAggregator');

/**
 * Memindai postingan publik kompetitor dan memperbarui rangkuman polanya
 * @param {string} profileId 
 * @param {string} token 
 */
async function syncCompetitorObservations(profileId, token) {
  const docRef = db.collection('threads_monitored_profiles').doc(profileId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Profil kompetitor tidak ditemukan.');

  const profile = doc.data();
  const username = profile.username;

  try {
    // Cari postingan publik yang menyebut atau dibuat oleh username ini
    const searchRes = await searchPosts(token, username, { limit: 15, searchType: 'RECENT' });
    const posts = searchRes.data || [];

    for (const p of posts) {
      await recordCompetitorPost({
        profileId,
        competitorUsername: username,
        threadId: p.id,
        caption: p.text || '',
        timestamp: p.timestamp || new Date().toISOString(),
        mediaType: p.media_type || 'TEXT_POST',
      });
    }

    // Agregasikan insight
    const insightsSummary = await aggregateCompetitorInsights(profileId);
    if (insightsSummary) {
      await docRef.update({
        insights_summary: insightsSummary,
        last_crawled_at: new Date().toISOString(),
      });
    }

    return { success: true, observedCount: posts.length, insightsSummary };
  } catch (err) {
    console.error(`[CompetitorService] Error syncing competitor @${username}:`, err.message);
    throw err;
  }
}

module.exports = {
  syncCompetitorObservations,
};
