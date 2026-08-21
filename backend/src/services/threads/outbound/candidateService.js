const { db } = require('../../../config/firebase');
const { sendTelegramReport } = require('../../telegramService');
const { dispatchReply } = require('../publishing/replyDispatcher');
const { evaluateCompliance } = require('../safety/complianceEngine');

/**
 * Menyimpan kandidat baru ke dalam antrean (Mode SAFE) & mengirim alert ke Telegram
 */
async function createCandidate(candidateData) {
  const {
    userId,
    accountId,
    threadId,
    authorId = null,
    authorUsername = '',
    postText = '',
    postTimestamp = new Date().toISOString(),
    keyword = '',
    buyingIntentScore = 0.85,
    relevanceScore = 0.85,
    matchedProductId,
    matchedProductTitle = '',
    replyTemplateStyle = 'helpful',
    replyTextDraft = '',
  } = candidateData;

  const docId = `cand_${accountId}_${threadId}`;
  const docRef = db.collection('threads_candidates').doc(docId);
  const existing = await docRef.get();

  if (existing.exists) {
    return { created: false, id: docId, status: existing.data().status };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const newDoc = {
    id: docId,
    user_id: userId,
    account_id: accountId,
    thread_id: String(threadId),
    author_id: String(authorId || ''),
    author_username: String(authorUsername || ''),
    post_text: postText,
    post_timestamp: postTimestamp,
    keyword,
    buying_intent_score: buyingIntentScore,
    relevance_score: relevanceScore,
    matched_product_id: matchedProductId,
    matched_product_title: matchedProductTitle,
    reply_template_style: replyTemplateStyle,
    reply_text_draft: replyTextDraft,
    status: 'PENDING', // PENDING | APPROVED | REJECTED | SENT | FAILED | EXPIRED | SKIPPED | BLOCKED
    created_at: now.toISOString(),
    expires_at: expiresAt,
  };

  await docRef.set(newDoc);
  console.log(`[CandidateService] 📥 Kandidat baru disimpan: #${docId} (@${authorUsername})`);

  // Kirim notifikasi Telegram Alert jika Buying Intent >= 0.80
  if (buyingIntentScore >= 0.80) {
    try {
      let alertMsg = `<b>🎯 CALON PEMBELI TERDETEKSI DI THREADS!</b>\n\n`;
      alertMsg += `• <b>Penulis:</b> @${authorUsername || 'pengguna'}\n`;
      alertMsg += `• <b>Postingan:</b> <i>"${postText.slice(0, 100)}..."</i>\n`;
      alertMsg += `• <b>Rekomendasi Produk:</b> <code>${matchedProductTitle || matchedProductId}</code>\n`;
      alertMsg += `• <b>Skor Niat Beli:</b> <b>${Math.round(buyingIntentScore * 100)}%</b> | Relevansi: <b>${Math.round(relevanceScore * 100)}%</b>\n\n`;
      alertMsg += `👉 <i>Buka tab <b>Threads Auto-Marketing</b> di dashboard untuk menyetujui (Approve) balasan ini.</i>`;

      sendTelegramReport(userId, alertMsg).catch(console.error);
    } catch (_) {}
  }

  return { created: true, id: docId, status: 'PENDING' };
}

/**
 * Mengambil daftar kandidat untuk dashboard dengan auto-expiration check (24 jam)
 */
async function listCandidates(userId, statusFilter = 'ALL') {
  try {
    const snap = await db.collection('threads_candidates')
      .where('user_id', '==', userId)
      .get();

    const nowIso = new Date().toISOString();
    const candidates = [];

    for (const doc of snap.docs) {
      const c = { id: doc.id, ...doc.data() };

      // Auto-expire jika usia post / kandidat > 24 jam dan masih PENDING
      if (c.status === 'PENDING' && c.expires_at && c.expires_at < nowIso) {
        c.status = 'EXPIRED';
        db.collection('threads_candidates').doc(doc.id).update({ status: 'EXPIRED' }).catch(() => {});
      }

      if (statusFilter === 'ALL' || c.status === statusFilter) {
        candidates.push(c);
      }
    }

    candidates.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return candidates;
  } catch (err) {
    console.error('[CandidateService] Error listing candidates:', err.message);
    return [];
  }
}

/**
 * Menyetujui kandidat dan mempublikasikan balasannya atau quote post ke Threads
 */
async function approveCandidate(candidateId, userId, options = {}) {
  const customReplyText = typeof options === 'string' ? options : (options.customReplyText || null);
  const publishMode = (typeof options === 'object' && options.publishMode) ? options.publishMode : 'REPLY';

  const docRef = db.collection('threads_candidates').doc(candidateId);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new Error('Kandidat tidak ditemukan.');
  }

  const candidate = doc.data();
  if (candidate.user_id !== userId) {
    throw new Error('Akses ditolak.');
  }

  if (candidate.status === 'SENT') {
    throw new Error('Kandidat ini sudah pernah dipublikasikan.');
  }

  // 1. Ambil akun Threads terkait
  const accDoc = await db.collection('social_accounts').doc(candidate.account_id).get();
  if (!accDoc.exists) {
    throw new Error('Akun Threads pengirim tidak ditemukan.');
  }
  const account = accDoc.data();

  // 2. Evaluasi Compliance
  const compliance = await evaluateCompliance({
    userId,
    accountId: candidate.account_id,
    threadId: candidate.thread_id,
    authorId: candidate.author_id,
    productId: candidate.matched_product_id,
    actionType: 'OUTBOUND',
    token: account.access_token,
  });

  if (compliance.decision !== 'ALLOW') {
    await docRef.update({ status: 'BLOCKED', block_reason: compliance.reason });
    throw new Error(`Balasan diblokir Compliance Engine: ${compliance.reason}`);
  }

  // 3. Eksekusi publikasi
  try {
    await docRef.update({ status: 'SENDING' });

    const dispatchResult = await dispatchReply({
      userId,
      accountId: candidate.account_id,
      threadsUserId: account.page_id,
      token: account.access_token,
      targetReplyId: candidate.thread_id,
      threadId: candidate.thread_id,
      authorId: candidate.author_id,
      authorUsername: candidate.author_username,
      productId: candidate.matched_product_id,
      actionType: publishMode === 'QUOTE' ? 'QUOTE' : 'OUTBOUND',
      publishMode,
      style: candidate.reply_template_style || 'helpful',
      customReplyText,
    });

    await docRef.update({
      status: 'SENT',
      published_post_id: dispatchResult.publishedPostId,
      final_reply_text: dispatchResult.finalReplyText,
      sent_at: new Date().toISOString(),
    });

    return { success: true, publishedPostId: dispatchResult.publishedPostId };
  } catch (err) {
    await docRef.update({ status: 'FAILED', fail_reason: err.message });
    throw err;
  }
}

/**
 * Menolak kandidat
 */
async function rejectCandidate(candidateId, userId, reason = 'Ditolak manual oleh pengguna') {
  const docRef = db.collection('threads_candidates').doc(candidateId);
  const doc = await docRef.get();

  if (!doc.exists) throw new Error('Kandidat tidak ditemukan.');
  if (doc.data().user_id !== userId) throw new Error('Akses ditolak.');

  await docRef.update({
    status: 'REJECTED',
    reject_reason: reason,
    rejected_at: new Date().toISOString(),
  });

  return { success: true };
}

module.exports = {
  createCandidate,
  listCandidates,
  approveCandidate,
  rejectCandidate,
};
