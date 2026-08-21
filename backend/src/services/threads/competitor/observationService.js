const { db } = require('../../../config/firebase');

/**
 * Menyimpan observasi mentah postingan publik kompetitor
 * @param {Object} observation 
 */
async function recordCompetitorPost(observation) {
  const {
    profileId,
    competitorUsername,
    threadId,
    caption = '',
    timestamp = new Date().toISOString(),
    mediaType = 'TEXT_POST',
  } = observation;

  const docId = `obs_${profileId}_${threadId}`;
  const docRef = db.collection('threads_competitor_observations').doc(docId);
  const existing = await docRef.get();

  if (existing.exists) return { recorded: false, id: docId };

  // Ekstrak hook (kalimat pertama sebelum newline atau 60 karakter pertama)
  const lines = caption.split('\n').filter(l => Boolean(l.trim()));
  const extractedHook = lines[0] ? lines[0].slice(0, 80).trim() : caption.slice(0, 80);

  const docData = {
    id: docId,
    profile_id: profileId,
    competitor_username: competitorUsername,
    thread_id: String(threadId),
    caption,
    extracted_hook: extractedHook,
    media_type: mediaType,
    post_timestamp: timestamp,
    observed_at: new Date().toISOString(),
  };

  await docRef.set(docData);
  return { recorded: true, id: docId };
}

module.exports = {
  recordCompetitorPost,
};
