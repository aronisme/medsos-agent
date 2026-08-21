const { publishTextReply, publishQuotePost } = require('../api/threadsReplyApi');
const { resolveAffiliateLink } = require('../products/affiliateLinkResolver');
const { composeReply } = require('./replyComposer');
const { acquireLock, markSuccess, releaseLock } = require('../safety/idempotencyService');
const { incrementReplyUsage } = require('../safety/quotaService');

/**
 * Dispatcher sentral untuk mempublikasikan balasan atau Quote Post ke Threads
 * @param {Object} options 
 * @param {string} options.userId 
 * @param {string} options.accountId 
 * @param {string} options.threadsUserId 
 * @param {string} options.token 
 * @param {string} options.targetReplyId 
 * @param {string} options.threadId 
 * @param {string} options.authorId 
 * @param {string} options.authorUsername 
 * @param {string} options.productId 
 * @param {'INBOUND'|'OUTBOUND'|'QUOTE'} [options.actionType='INBOUND'] 
 * @param {'REPLY'|'QUOTE'} [options.publishMode='REPLY'] 
 * @param {'helpful'|'casual'|'direct'} [options.style='helpful'] 
 * @param {string} [options.customReplyText] 
 */
async function dispatchReply(options) {
  const {
    userId,
    accountId,
    threadsUserId,
    token,
    targetReplyId,
    threadId,
    authorId,
    authorUsername,
    productId,
    actionType = 'INBOUND',
    publishMode = 'REPLY',
    style = 'helpful',
    customReplyText = null,
  } = options;

  // 1. Tentukan kunci idempotensi unik
  const idempotencyKey = actionType === 'INBOUND'
    ? `inbound_${accountId}_reply_${targetReplyId}`
    : `outbound_${accountId}_thread_${threadId}_${publishMode.toLowerCase()}`;

  // 2. Ambil Lock Atomik
  const lockAcquired = await acquireLock(idempotencyKey, {
    user_id: userId,
    account_id: accountId,
    thread_id: String(threadId),
    target_reply_id: String(targetReplyId),
    author_id: String(authorId || ''),
    author_username: String(authorUsername || ''),
    product_id: productId,
    action_type: actionType,
    publish_mode: publishMode,
  });

  if (!lockAcquired) {
    return {
      success: false,
      skipped: true,
      reason: `Idempotency lock ditolak. ${idempotencyKey} sudah pernah/sedang diproses.`,
    };
  }

  try {
    // 3. Resolusi live link afiliasi deterministik
    const affiliateUrl = await resolveAffiliateLink(productId, userId);

    // 4. Susun teks balasan akhir
    let finalReplyText;
    if (customReplyText) {
      finalReplyText = customReplyText.includes('http')
        ? customReplyText
        : `${customReplyText} ${affiliateUrl}`;
    } else {
      finalReplyText = composeReply({
        style,
        affiliateUrl,
        authorUsername,
      });
    }

    // 5. Kirim via Threads API (Reply atau Quote Post)
    let publishRes;
    if (publishMode === 'QUOTE' || actionType === 'QUOTE') {
      publishRes = await publishQuotePost(threadsUserId, token, {
        quotePostId: threadId || targetReplyId,
        text: finalReplyText,
      });
    } else {
      publishRes = await publishTextReply(threadsUserId, token, {
        replyToId: targetReplyId,
        text: finalReplyText,
      });
    }

    // 6. Catat sukses dan perbarui kuota
    await markSuccess(idempotencyKey, {
      publishedPostId: publishRes.publishedId,
      finalReplyText,
    });

    await incrementReplyUsage(userId, accountId, actionType);

    console.log(`[ReplyDispatcher] ✅ Berhasil mengirim ${actionType} reply #${publishRes.publishedId} ke ${authorUsername}`);
    return {
      success: true,
      publishedPostId: publishRes.publishedId,
      finalReplyText,
    };
  } catch (err) {
    await releaseLock(idempotencyKey, err.message);
    console.error(`[ReplyDispatcher] ❌ Gagal mengirim reply:`, err.message);
    throw err;
  }
}

module.exports = {
  dispatchReply,
};
