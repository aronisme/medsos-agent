const { db } = require('../../../config/firebase');

/**
 * Mendapatkan lock unik sebelum membalas untuk mencegah duplicate/race condition
 * @param {string} idempotencyKey - Kunci unik misal: "inbound_acc1_reply123"
 * @param {Object} metadata 
 * @returns {Promise<boolean>} true jika lock berhasil didapat, false jika sudah pernah diproses
 */
async function acquireLock(idempotencyKey, metadata = {}) {
  try {
    const docRef = db.collection('threads_auto_reply_logs').doc(idempotencyKey);
    const doc = await docRef.get();
    
    if (doc.exists) {
      const data = doc.data() || {};
      if (data.status === 'SENT') {
        return false; // Sudah sukses terkirim, jangan kirim duplikat
      }
      if (data.status === 'PROCESSING') {
        // Jika sedang processing lebih dari 2 menit (stale lock), izinkan retry
        const createdAt = new Date(data.created_at || 0).getTime();
        if (Date.now() - createdAt < 120000) {
          return false;
        }
      }
      // Jika statusnya FAILED atau stale PROCESSING, izinkan retry
    }

    await docRef.set({
      id: idempotencyKey,
      idempotency_key: idempotencyKey,
      status: 'PROCESSING',
      created_at: new Date().toISOString(),
      ...metadata,
    }, { merge: true });

    return true;
  } catch (err) {
    console.error(`[IdempotencyService] Gagal acquire lock untuk ${idempotencyKey}:`, err.message);
    return false;
  }
}

/**
 * Mengupdate status log setelah berhasil dikirim
 */
async function markSuccess(idempotencyKey, { publishedPostId, finalReplyText }) {
  try {
    const docRef = db.collection('threads_auto_reply_logs').doc(idempotencyKey);
    await docRef.update({
      status: 'SENT',
      published_post_id: publishedPostId || null,
      final_reply_text: finalReplyText || null,
      replied_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(`[IdempotencyService] Warning updating log ${idempotencyKey}:`, err.message);
  }
}

/**
 * Melepaskan lock jika proses gagal di tengah jalan
 */
async function releaseLock(idempotencyKey, reason = '') {
  try {
    const docRef = db.collection('threads_auto_reply_logs').doc(idempotencyKey);
    await docRef.update({
      status: 'FAILED',
      fail_reason: reason,
      failed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(`[IdempotencyService] Warning releasing lock ${idempotencyKey}:`, err.message);
  }
}

module.exports = {
  acquireLock,
  markSuccess,
  releaseLock,
};
