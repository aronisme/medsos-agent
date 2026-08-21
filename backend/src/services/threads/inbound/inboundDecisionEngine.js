const { db } = require('../../../config/firebase');
const { classifyCommentIntent } = require('./intentClassifier');
const { evaluateCompliance } = require('../safety/complianceEngine');
const { dispatchReply } = require('../publishing/replyDispatcher');

/**
 * Memproses 1 komentar masuk pada postingan sendiri
 * @param {Object} params 
 * @param {Object} params.reply - Data objek komentar dari API Threads
 * @param {string} params.threadId - ID Utas utama
 * @param {Object} params.account - Data akun sosial media dari DB
 * @param {string} params.userId - ID User pemilik akun
 */
async function processSingleInboundReply({ reply, threadId, account, userId }) {
  // 1. Lewati jika komentar berasal dari akun kita sendiri
  if (reply.username && reply.username.toLowerCase() === (account.page_name || '').toLowerCase()) {
    return { processed: false, reason: 'Komentar sendiri diabaikan.' };
  }

  // 2. Ambil konteks produk dari threads_post_context
  const ctxRef = db.collection('threads_post_context').doc(`ctx_${threadId}`);
  const ctxDoc = await ctxRef.get();
  
  if (!ctxDoc.exists) {
    return { processed: false, reason: `Tidak ditemukan data context produk untuk thread #${threadId}` };
  }

  const contextData = ctxDoc.data();
  const productId = contextData.product_id;

  if (!productId) {
    return { processed: false, reason: 'Utas ini tidak terikat pada produk affiliate apapun.' };
  }

  // 3. Klasifikasi intensi komentar menggunakan Intent AI
  const intentResult = await classifyCommentIntent(reply.text);
  console.log(`[InboundEngine] Komentar "${reply.text?.slice(0, 30)}..." -> Intent: ${intentResult.intent} (${intentResult.confidence})`);

  // Hanya proses jika berniat meminta link atau bertanya produk
  if (intentResult.intent !== 'LINK_REQUEST' && intentResult.intent !== 'PRODUCT_QUESTION') {
    return {
      processed: false,
      intent: intentResult.intent,
      reason: `Intensi bukan permintaan link (${intentResult.intent}).`,
    };
  }

  // 4. Lakukan evaluasi Three-Tier Compliance
  const compliance = await evaluateCompliance({
    userId,
    accountId: account.id,
    threadId,
    authorId: reply.id, // Gunakan ID reply/author untuk cooldown
    productId,
    actionType: 'INBOUND',
    token: account.access_token,
  });

  if (compliance.decision !== 'ALLOW') {
    console.warn(`[InboundEngine] ⛔ Balasan diblokir oleh Compliance Engine: ${compliance.reason}`);
    return { processed: false, reason: compliance.reason };
  }

  // 5. Eksekusi publikasi balasan melalui Dispatcher
  try {
    const dispatchResult = await dispatchReply({
      userId,
      accountId: account.id,
      threadsUserId: account.page_id,
      token: account.access_token,
      targetReplyId: reply.id,
      threadId,
      authorId: reply.id,
      authorUsername: reply.username || '',
      productId,
      actionType: 'INBOUND',
      style: 'helpful',
    });

    return {
      processed: true,
      success: dispatchResult.success,
      publishedPostId: dispatchResult.publishedPostId,
    };
  } catch (err) {
    return { processed: false, error: err.message };
  }
}

module.exports = {
  processSingleInboundReply,
};
