const { db } = require('../../../config/firebase');

/**
 * Memeriksa apakah pengguna Threads (author) sedang dalam masa cooldown 24 jam
 * @param {string} userId - ID User aplikasi
 * @param {string} authorId - ID Penulis komentar di Threads
 * @param {number} [cooldownHours=24] 
 */
async function checkUserCooldown(userId, authorId, cooldownHours = 24) {
  if (!authorId) return { inCooldown: false };

  try {
    const cutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();
    const snapshot = await db.collection('threads_auto_reply_logs')
      .where('user_id', '==', userId)
      .where('author_id', '==', String(authorId))
      .get();

    const recentLogs = snapshot.docs
      .map(d => d.data())
      .filter(l => l.status === 'SENT' && (l.replied_at || l.created_at || '') >= cutoff);

    if (recentLogs.length > 0) {
      return {
        inCooldown: true,
        reason: `Pengguna #${authorId} telah menerima balasan promosi dalam ${cooldownHours} jam terakhir.`,
        lastRepliedAt: recentLogs[0].replied_at,
      };
    }

    return { inCooldown: false };
  } catch (err) {
    console.warn('[CooldownService] Warning checking user cooldown:', err.message);
    return { inCooldown: false };
  }
}

/**
 * Memeriksa apakah sebuah thread/utas sudah pernah dibalas promosi
 * @param {string} userId 
 * @param {string} threadId 
 * @param {number} [maxReplies=1] 
 */
async function checkThreadLimit(userId, threadId, maxReplies = 1) {
  if (!threadId) return { limitReached: false };

  try {
    const snapshot = await db.collection('threads_auto_reply_logs')
      .where('user_id', '==', userId)
      .where('thread_id', '==', String(threadId))
      .get();

    const sentLogs = snapshot.docs
      .map(d => d.data())
      .filter(l => l.status === 'SENT');

    if (sentLogs.length >= maxReplies) {
      return {
        limitReached: true,
        reason: `Thread #${threadId} sudah mencapai batas maksimum (${maxReplies}) balasan promosi.`,
      };
    }

    return { limitReached: false };
  } catch (err) {
    console.warn('[CooldownService] Warning checking thread limit:', err.message);
    return { limitReached: false };
  }
}

module.exports = {
  checkUserCooldown,
  checkThreadLimit,
};
