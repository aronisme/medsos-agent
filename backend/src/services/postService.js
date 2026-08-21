const { db } = require('../config/firebase');
const env = require('../config/env');
const { postToFacebook } = require('./facebookService');
const { postToInstagram } = require('./instagramService');
const { postToThreads } = require('./threadsService');

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
        postId: `${target.platform === 'facebook' ? 'fb' : 'ig'}_dryrun_${Date.now()}`,
        dryRun: true,
      };
    } else if (target.platform === 'facebook') {
      result = await postToFacebook(account, post.content, post.media, post.post_type || 'feed');
    } else if (target.platform === 'instagram') {
      result = await postToInstagram(account, post.content, post.media);
    } else if (target.platform === 'threads') {
      result = await postToThreads(account, post.content, post.media, post.threads_options || {});
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
        const pubRes = await publishTarget(post, t, accDoc.data());
        t.status = 'success';
        t.post_id_on_platform = pubRes.postId;
        t.error_message = null;
        results.push(pubRes);
      } catch (err) {
        t.status = 'failed';
        t.error_message = err.message;
        results.push({ success: false, error: err.message });
      }
      t.processed_at = new Date().toISOString();
    }
  }

  if (targetsUpdated) {
    const newStatus = computePostStatus(targets);
    const updateData = { 
      targets, 
      status: newStatus,
      updated_at: new Date().toISOString()
    };
    if (newStatus === 'posted' && !post.posted_at) {
      updateData.posted_at = new Date().toISOString();
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
          published_at: new Date().toISOString(),
          status: newStatus === 'posted' ? 'published' : newStatus,
          updated_at: new Date().toISOString()
        });
      }
    } catch (memErr) {
      console.warn('[publishPostNow] Memory sync warning:', memErr.message);
    }
  }

  return results;
}

module.exports = { publishPostNow, addLog };
