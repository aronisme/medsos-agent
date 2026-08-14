const db = require('../db');
const env = require('../config/env');
const { postToFacebook } = require('./facebookService');
const { postToInstagram } = require('./instagramService');

function getPostWithRelations(postId) {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  if (!post) return null;
  const media = db.prepare('SELECT * FROM post_media WHERE post_id = ? ORDER BY sort_order ASC').all(postId);
  const targets = db.prepare('SELECT * FROM post_targets WHERE post_id = ? ORDER BY id ASC').all(postId);
  return { ...post, media, targets };
}

function addLog(userId, action, details) {
  db.prepare('INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)').run(
    userId,
    action,
    typeof details === 'string' ? details : JSON.stringify(details)
  );
}

/**
 * Update status post induk berdasarkan hasil semua target-nya.
 */
function updatePostStatusFromTargets(postId) {
  const targets = db.prepare('SELECT status FROM post_targets WHERE post_id = ?').all(postId);
  if (targets.length === 0) return;
  const success = targets.filter((t) => t.status === 'success').length;
  const failed = targets.filter((t) => t.status === 'failed').length;

  let status;
  if (success > 0 && failed === 0) status = 'posted';
  else if (success > 0 && failed > 0) status = 'posted'; // sebagian berhasil
  else status = 'failed'; // semua gagal

  const setPostedAt = status === 'posted' ? "datetime('now')" : null;
  db.prepare(
    `UPDATE posts SET status = ?, posted_at = COALESCE(?, posted_at), updated_at = datetime('now') WHERE id = ?`
  ).run(status, setPostedAt, postId);
}

/**
 * Publish satu target posting (dipanggil scheduler & manual publish).
 */
async function publishTarget(targetId) {
  const target = db.prepare('SELECT * FROM post_targets WHERE id = ?').get(targetId);
  if (!target) throw new Error(`Target ${targetId} tidak ditemukan.`);
  if (target.status === 'success') return { skipped: true };

  const account = db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(target.account_id);
  if (!account) throw new Error('Akun sosial tidak ditemukan.');
  const post = getPostWithRelations(target.post_id);
  if (!post) throw new Error('Postingan tidak ditemukan.');

  // Tandai processing
  db.prepare(
    `UPDATE post_targets SET status = 'processing', attempt_count = attempt_count + 1 WHERE id = ?`
  ).run(targetId);

  try {
    let result;

    if (env.dryRun || !account.access_token) {
      // Mode simulasi: dicatat sukses dengan ID semu
      await new Promise((r) => setTimeout(r, 1200)); // simulasi kerja
      result = {
        postId: `${target.platform === 'facebook' ? 'fb' : 'ig'}_dryrun_${Date.now()}`,
        dryRun: true,
      };
    } else if (target.platform === 'facebook') {
      result = await postToFacebook(account, post.content, post.media, post.post_type || 'feed');
    } else if (target.platform === 'instagram') {
      result = await postToInstagram(account, post.content, post.media);
    } else {
      throw new Error(`Platform tidak dikenal: ${target.platform}`);
    }

    db.prepare(
      `UPDATE post_targets SET status = 'success', post_id_on_platform = ?, error_message = NULL, processed_at = datetime('now') WHERE id = ?`
    ).run(result.postId, targetId);

    addLog(post.user_id, result.dryRun ? 'post_success_dryrun' : 'post_success', {
      targetId,
      platform: target.platform,
      postIdOnPlatform: result.postId,
    });
    updatePostStatusFromTargets(post.id);
    return { success: true, postId: result.postId, dryRun: result.dryRun };
  } catch (err) {
    const message = err?.response?.data?.error?.message || err?.response?.data?.message || err.message;
    db.prepare(
      `UPDATE post_targets SET status = 'failed', error_message = ?, processed_at = datetime('now') WHERE id = ?`
    ).run(message, targetId);
    addLog(post.user_id, 'post_failed', { targetId, platform: target.platform, error: message });
    updatePostStatusFromTargets(post.id);
    throw new Error(message);
  }
}

/**
 * Publish semua target pending/failed dari sebuah post, atau publish post draft langsung.
 */
async function publishPostNow(postId) {
  const post = getPostWithRelations(postId);
  if (!post) throw new Error('Postingan tidak ditemukan.');

  const targets = db
    .prepare(`SELECT * FROM post_targets WHERE post_id = ? AND status IN ('pending','failed')`)
    .all(postId);

  if (targets.length === 0) {
    // Post belum punya target → buat dari akun aktif user
    const accounts = db.prepare('SELECT * FROM social_accounts WHERE user_id = ? AND is_active = 1').all(post.user_id);
    for (const acc of accounts) {
      db.prepare(
        `INSERT INTO post_targets (post_id, account_id, platform) VALUES (?, ?, ?)`
      ).run(postId, acc.id, acc.platform);
    }
  }

  const all = db.prepare(`SELECT id FROM post_targets WHERE post_id = ? AND status IN ('pending','failed')`).all(postId);
  const results = [];
  for (const t of all) {
    try {
      results.push(await publishTarget(t.id));
    } catch (e) {
      const msg = e?.response?.data?.error?.message || e.message;
      results.push({ success: false, error: msg });
    }
  }
  return results;
}

module.exports = { publishTarget, publishPostNow, getPostWithRelations, addLog, updatePostStatusFromTargets };
