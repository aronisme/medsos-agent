const { db } = require('../config/firebase');
const { publishPostNow } = require('../services/postService');

/**
 * Memproses postingan terjadwal yang sudah waktunya.
 * Fungsi ini bisa dipanggil manual via cron route.
 */
async function processScheduledPosts() {
  const results = [];
  try {
    const snapshot = await db.collection('posts')
      .where('status', '==', 'scheduled')
      .where('scheduled_at', '<=', new Date().toISOString())
      .get();
      
    if (snapshot.empty) {
      return results;
    }

    // Since firestore doesn't do joins, we just process all scheduled posts
    // and rely on publishPostNow to handle targets correctly.
    for (const doc of snapshot.docs) {
      try {
        await publishPostNow(doc.id);
        const msg = `[scheduler] ✅ Processed Post #${doc.id}`;
        console.log(msg);
        results.push(msg);
      } catch (e) {
        const err = `[scheduler] ❌ Process Post #${doc.id} failed: ${e.message}`;
        console.error(err);
        results.push(err);
      }
    }
  } catch (e) {
    console.error('[scheduler] error:', e.message);
    throw e;
  }
  return results;
}

module.exports = { processScheduledPosts };
