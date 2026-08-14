const { db } = require('../config/firebase');
const { publishPostNow } = require('../services/postService');

/**
 * Memproses postingan terjadwal yang sudah waktunya.
 * Fungsi ini dipanggil otomatis setiap menit oleh Google Apps Script / Cron.
 */
async function processScheduledPosts() {
  const results = [];
  try {
    const snapshot = await db.collection('posts')
      .where('status', '==', 'scheduled')
      .get();
      
    if (snapshot.empty) {
      return results;
    }

    const now = Date.now();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.scheduled_at) continue;

      // Parsing waktu jadwal (mendukung format ISO UTC maupun string lokal)
      let scheduledTime = new Date(data.scheduled_at).getTime();
      
      // Jika string waktu dalam format "YYYY-MM-DD HH:mm" tanpa timezone, parse dengan toleransi
      if (isNaN(scheduledTime)) {
        scheduledTime = new Date(String(data.scheduled_at).replace(' ', 'T')).getTime();
      }

      // Jika waktu jadwal sudah tercapai atau terlewat
      if (!isNaN(scheduledTime) && scheduledTime <= now) {
        try {
          await publishPostNow(doc.id);
          const msg = `[scheduler] ✅ Berhasil mempublish postingan terjadwal #${doc.id}`;
          console.log(msg);
          results.push({ postId: doc.id, success: true, message: msg });
        } catch (e) {
          const err = `[scheduler] ❌ Gagal publish postingan #${doc.id}: ${e.message}`;
          console.error(err);
          results.push({ postId: doc.id, success: false, error: err });
        }
      }
    }
  } catch (e) {
    console.error('[scheduler] error:', e.message);
    throw e;
  }
  return results;
}

module.exports = { processScheduledPosts };
