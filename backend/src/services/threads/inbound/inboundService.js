const { db } = require('../../../config/firebase');
const { get } = require('../api/threadsApiClient');
const { getReplies } = require('../api/threadsReplyApi');
const { processSingleInboundReply } = require('./inboundDecisionEngine');

/**
 * Memindai komentar-komentar terbaru pada postingan akun Threads milik pengguna
 * @param {string} userId - ID User
 */
async function scanAndProcessInboundReplies(userId) {
  const summary = { totalScanned: 0, totalReplied: 0, errors: [] };

  try {
    // 1. Ambil seluruh akun Threads aktif milik pengguna ini
    const accountsSnap = await db.collection('social_accounts')
      .where('user_id', '==', userId)
      .where('platform', '==', 'threads')
      .where('is_active', 'in', [1, true, '1'])
      .get();

    if (accountsSnap.empty) {
      return summary;
    }

    const threadsAccounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Himpun seluruh username/handle akun milik pengguna untuk menghindari membalas akun internal sendiri
    const ownedUsernames = new Set();
    threadsAccounts.forEach(acc => {
      if (acc.page_name) ownedUsernames.add(acc.page_name.toLowerCase().trim());
      if (acc.username) ownedUsernames.add(acc.username.toLowerCase().trim());
      if (acc.name) ownedUsernames.add(acc.name.toLowerCase().trim());
      if (acc.page_id) ownedUsernames.add(String(acc.page_id).trim());
    });

    for (const account of threadsAccounts) {
      const token = account.access_token;
      if (!token) continue;

      try {
        // 2. Ambil 5 postingan terbaru dari akun Threads ini
        const postsRes = await get('me/threads', token, { fields: 'id,timestamp', limit: 5 });
        const recentThreads = postsRes.data || [];

        for (const thread of recentThreads) {
          try {
            // 3. Ambil komentar-komentar pada thread ini
            const repliesRes = await getReplies(thread.id, token, { limit: 15 });
            const replies = repliesRes.data || [];
            summary.totalScanned += replies.length;

            for (const reply of replies) {
              const res = await processSingleInboundReply({
                reply,
                threadId: thread.id,
                account,
                userId,
                ownedUsernames,
              });

              if (res?.processed && res?.success) {
                summary.totalReplied++;
              }
            }
          } catch (replyErr) {
            console.warn(`[InboundService] Warning fetching replies for thread #${thread.id}:`, replyErr.message);
          }
        }
      } catch (accErr) {
        console.error(`[InboundService] Error scanning account @${account.page_name}:`, accErr.message);
        summary.errors.push(accErr.message);
      }
    }
  } catch (err) {
    console.error('[InboundService] Fatal error in scanAndProcessInboundReplies:', err.message);
    summary.errors.push(err.message);
  }

  return summary;
}

module.exports = {
  scanAndProcessInboundReplies,
};
