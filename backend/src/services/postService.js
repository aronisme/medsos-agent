const { db } = require('../config/firebase');
const env = require('../config/env');
const { postToFacebook } = require('./facebookService');
const { postToInstagram } = require('./instagramService');
const { postToThreads, publishThreadsPost, publishThreadsReply } = require('./threadsService');

async function addLog(userId, action, details) {
  await db.collection('logs').add({
    user_id: userId,
    action,
    details: typeof details === 'string' ? details : JSON.stringify(details),
    created_at: new Date().toISOString()
  });
}

function computePostStatus(targets) {
  if (!targets || targets.length === 0) return 'draft';
  const success = targets.filter(t => t.status === 'success').length;
  const failed = targets.filter(t => t.status === 'failed').length;
  if (success > 0) return 'posted';
  if (failed > 0) return 'failed';
  return 'scheduled';
}

async function publishTarget(post, target, account) {
  try {
    let result;
    if (env.dryRun || !account.access_token) {
      await new Promise(r => setTimeout(r, 1200));
      result = {
        postId: `${target.platform === 'facebook' ? 'fb' : (target.platform === 'threads' ? 'th' : 'ig')}_dryrun_${Date.now()}`,
        dryRun: true,
      };
    } else if (target.platform === 'facebook') {
      result = await postToFacebook(account, post.content, post.media, post.post_type || 'feed');
    } else if (target.platform === 'instagram') {
      result = await postToInstagram(account, post.content, post.media);
    } else if (target.platform === 'threads') {
      result = await publishThreadsPost(account, post.content, post.media, post.threads_options || {});
    } else {
      throw new Error(`Platform tidak dikenal: ${target.platform}`);
    }

    await addLog(post.user_id, result.dryRun ? 'post_success_dryrun' : 'post_success', {
      targetId: target.id,
      platform: target.platform,
      postIdOnPlatform: result.postId,
    });
    
    return { success: true, postId: result.postId, dryRun: result.dryRun };
  } catch (err) {
    const message = err?.response?.data?.error?.error_user_msg || err?.response?.data?.error?.message || err?.response?.data?.message || err.message;
    await addLog(post.user_id, 'post_failed', { targetId: target.id, platform: target.platform, error: message });
    throw new Error(message);
  }
}

async function publishPostNow(postId) {
  const docRef = db.collection('posts').doc(postId);
  const doc = await docRef.get();
  if (!doc.exists) throw new Error('Postingan tidak ditemukan.');

  const post = doc.data();
  let targets = post.targets || [];

  if (targets.length === 0) {
    const accountsSnap = await db.collection('social_accounts')
      .where('user_id', '==', post.user_id)
      .where('is_active', 'in', [1, true, '1'])
      .get();
      
    targets = accountsSnap.docs.map(accDoc => {
      const acc = accDoc.data();
      return {
        id: Math.random().toString(36).substring(2, 9),
        account_id: accDoc.id,
        platform: acc.platform,
        page_name: acc.page_name,
        status: 'pending',
        error_message: null,
        attempt_count: 0
      };
    });
  }

  const results = [];
  let targetsUpdated = false;
  let firstReplyUpdated = false;

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (t.status === 'pending' || t.status === 'failed') {
      targetsUpdated = true;
      t.status = 'processing';
      t.attempt_count = (t.attempt_count || 0) + 1;
      
      const accDoc = await db.collection('social_accounts').doc(t.account_id).get();
      if (!accDoc.exists) {
        t.status = 'failed';
        t.error_message = 'Akun sosial tidak ditemukan.';
        results.push({ success: false, error: t.error_message });
        continue;
      }
      
      try {
        // FASE 1: Publikasikan Root Post
        const pubRes = await publishTarget(post, t, accDoc.data());
        t.status = 'success';
        t.post_id_on_platform = pubRes.postId;
        t.error_message = null;
        results.push(pubRes);

        // FASE 2: Publikasikan First Reply (Khusus Threads dengan First Reply Enabled)
        if (t.platform === 'threads' && post.first_reply?.enabled && post.first_reply.text) {
          // Idempotency check: Jangan kirim ulang jika reply sudah berstatus published
          if (post.first_reply.status !== 'published' || !post.first_reply.reply_id) {
            post.first_reply.reply_attempts = (post.first_reply.reply_attempts || 0) + 1;
            try {
              let replyRes;
              // Defensive sanitize: pastikan hanya link afiliasi resmi yang diposting
              let cleanReplyText = post.first_reply.text;
              const affLink = post.first_reply.affiliate_url;
              if (affLink) {
                const lines = cleanReplyText.split('\n');
                const sanitizedLines = lines.map(line => {
                  if (line.includes(affLink)) return line;
                  return line.replace(/(https?:\/\/[^\s]+|s\.id\/[^\s]+|bit\.ly\/[^\s]+|shope\.ee\/[^\s]+|shopee\.co\.id\/[^\s]+)/gi, '').trim();
                }).filter(Boolean);
                cleanReplyText = sanitizedLines.join('\n');
                if (!cleanReplyText.includes(affLink)) {
                  cleanReplyText = `${cleanReplyText}\n🛒 ${affLink}`.trim();
                }
              }

              if (env.dryRun || !accDoc.data().access_token) {
                replyRes = { postId: `th_reply_dryrun_${Date.now()}` };
              } else {
                replyRes = await publishThreadsReply(accDoc.data(), cleanReplyText, pubRes.postId);
              }
              post.first_reply.text = cleanReplyText;
              post.first_reply.status = 'published';
              post.first_reply.reply_id = replyRes.postId;
              post.first_reply.reply_published_at = new Date().toISOString();
              post.first_reply.reply_last_error = null;
              firstReplyUpdated = true;
              
              await addLog(post.user_id, 'threads_first_reply_success', {
                targetId: t.id,
                rootPostId: pubRes.postId,
                replyId: replyRes.postId
              });
            } catch (replyErr) {
              const replyErrMsg = replyErr?.response?.data?.error?.message || replyErr.message;
              console.warn('[publishPostNow] Threads first reply warning:', replyErrMsg);
              post.first_reply.status = 'failed';
              post.first_reply.reply_last_error = replyErrMsg;
              firstReplyUpdated = true;

              await addLog(post.user_id, 'threads_first_reply_failed', {
                targetId: t.id,
                rootPostId: pubRes.postId,
                error: replyErrMsg
              });
            }
          }
        }
      } catch (err) {
        t.status = 'failed';
        t.error_message = err.message;
        results.push({ success: false, error: err.message });
      }
      t.processed_at = new Date().toISOString();
    }
  }

  if (targetsUpdated || firstReplyUpdated) {
    const newStatus = computePostStatus(targets);
    const updateData = { 
      targets, 
      status: newStatus,
      updated_at: new Date().toISOString()
    };
    if (newStatus === 'posted' && !post.posted_at) {
      updateData.posted_at = new Date().toISOString();
    }
    if (post.first_reply) {
      updateData.first_reply = post.first_reply;
    }
    await docRef.update(updateData);

    // Send Telegram Notification Report
    try {
      const successTargets = targets.filter(t => t.status === 'success');
      const failedTargets = targets.filter(t => t.status === 'failed');
      
      let reportMessage = `<b>📢 MEDSOS AGENT - STATUS PUBLIKASI</b>\n\n`;
      reportMessage += `<b>Post ID:</b> <code>#${postId.slice(0, 7)}</code>\n`;
      if (post.title) {
        reportMessage += `<b>Judul:</b> ${post.title}\n`;
      }
      reportMessage += `<b>Status:</b> ${newStatus === 'posted' ? '✅ Berhasil Dipublish' : '❌ Gagal Dipublish'}\n\n`;
      
      if (successTargets.length > 0) {
        reportMessage += `<b>✅ Sukses:</b>\n`;
        successTargets.forEach(t => {
          reportMessage += `- ${t.page_name} (Platform: ${t.platform.toUpperCase()})\n`;
        });
      }
      if (failedTargets.length > 0) {
        reportMessage += `\n<b>❌ Gagal:</b>\n`;
        failedTargets.forEach(t => {
          reportMessage += `- ${t.page_name} (Platform: ${t.platform.toUpperCase()}): <i>${t.error_message || 'Error tidak diketahui'}</i>\n`;
        });
      }

      const { sendTelegramReport } = require('./telegramService');
      sendTelegramReport(post.user_id, reportMessage).catch(console.error);
    } catch (tgErr) {
      console.warn('[publishPostNow] Failed to send Telegram report:', tgErr.message);
    }

    // Closed-Loop: Update post status & platform post ID di product_post_memory
    try {
      const memRef = db.collection('product_post_memory').doc(`mem_${postId}`);
      const memDoc = await memRef.get();
      if (memDoc.exists) {
        const successTarget = targets.find(t => t.status === 'success' && t.post_id_on_platform);
        await memRef.update({
          post_id_on_platform: successTarget ? successTarget.post_id_on_platform : null,
          reply_id_on_platform: post.first_reply?.reply_id || null,
          published_at: new Date().toISOString(),
          status: newStatus === 'posted' ? 'published' : newStatus,
          updated_at: new Date().toISOString()
        });
      }
    } catch (memErr) {
      console.warn('[publishPostNow] Memory sync warning:', memErr.message);
    }

    // Sync: Catat ke threads_post_context jika ada target Threads yang sukses
    try {
      const threadsTargets = targets.filter(t => t.platform === 'threads' && t.status === 'success' && t.post_id_on_platform);
      for (const tt of threadsTargets) {
        const memRef = db.collection('product_post_memory').doc(`mem_${postId}`);
        const memDoc = await memRef.get();
        const productId = memDoc.exists ? memDoc.data().product_id : (post.product_id || null);

        const ctxRef = db.collection('threads_post_context').doc(`ctx_${tt.post_id_on_platform}`);
        await ctxRef.set({
          id: `ctx_${tt.post_id_on_platform}`,
          account_id: tt.account_id,
          thread_id: String(tt.post_id_on_platform),
          reply_id: post.first_reply?.reply_id || null,
          post_id: postId,
          user_id: post.user_id,
          product_id: productId,
          caption: post.content || '',
          first_reply: post.first_reply?.text || '',
          published_at: new Date().toISOString(),
          status: 'ACTIVE',
        }, { merge: true });
      }
    } catch (ctxErr) {
      console.warn('[publishPostNow] Threads context sync warning:', ctxErr.message);
    }
  }

  return results;
}

module.exports = { publishPostNow, addLog };

