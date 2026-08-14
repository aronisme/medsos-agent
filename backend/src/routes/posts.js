const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const { publishPostNow } = require('../services/postService');
const router = express.Router();

router.use(authRequired);

// GET /api/posts?status=draft|scheduled|posted|failed&limit=20
router.get('/', (req, res) => {
  const { status, limit = 50 } = req.query;
  let sql = 'SELECT * FROM posts WHERE user_id = ?';
  const params = [req.user.id];
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit, 10) || 50);
  const rows = db.prepare(sql).all(...params);
  res.json({ posts: rows });
});

// GET /api/posts/:id (dengan media + targets + info akun)
router.get('/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!post) return res.status(404).json({ error: 'Postingan tidak ditemukan.' });

  const media = db.prepare('SELECT * FROM post_media WHERE post_id = ? ORDER BY sort_order ASC').all(post.id);
  const targets = db
    .prepare(
      `SELECT t.*, a.page_name, a.platform AS account_platform
       FROM post_targets t
       LEFT JOIN social_accounts a ON a.id = t.account_id
       WHERE t.post_id = ? ORDER BY t.id ASC`
    )
    .all(post.id);

  res.json({ post: { ...post, media, targets } });
});

// POST /api/posts — create (draft | scheduled)
// body: { title?, content, media?: [{url,type}], targets?: [accountId], scheduled_at?, post_type?: 'feed'|'reel' }
router.post('/', (req, res) => {
  const { title, content, media = [], targets = [], scheduled_at, post_type = 'feed' } = req.body || {};
  if (!content || !String(content).trim()) {
    return res.status(400).json({ error: 'Konten postingan wajib diisi.' });
  }

  let scheduledAt = null;
  if (scheduled_at) {
    const d = new Date(scheduled_at);
    if (isNaN(d.getTime())) return res.status(400).json({ error: 'Format scheduled_at tidak valid.' });
    if (d.getTime() <= Date.now()) return res.status(400).json({ error: 'Waktu jadwal harus di masa depan.' });
    scheduledAt = d.toISOString().slice(0, 19).replace('T', ' ');
  }

  const status = scheduledAt ? 'scheduled' : 'draft';
  const cleanPostType = post_type === 'reel' ? 'reel' : 'feed';

  const result = db.prepare(
    `INSERT INTO posts (user_id, title, content, status, scheduled_at, post_type) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(req.user.id, title || null, String(content).trim(), status, scheduledAt, cleanPostType);
  const postId = result.lastInsertRowid;

  // Simpan media
  let sort = 0;
  const insertMedia = db.prepare(
    `INSERT INTO post_media (post_id, media_url, media_type, sort_order) VALUES (?, ?, ?, ?)`
  );
  for (const m of media) {
    if (!m?.url) continue;
    insertMedia.run(postId, m.url, m.type === 'video' ? 'video' : 'image', sort++);
  }

  // Simpan target (validasi akun milik user)
  const validAccounts = db
    .prepare('SELECT id, platform FROM social_accounts WHERE user_id = ? AND is_active = 1')
    .all(req.user.id);
  const accountMap = new Map(validAccounts.map((a) => [a.id, a.platform]));
  const insertTarget = db.prepare(
    `INSERT INTO post_targets (post_id, account_id, platform) VALUES (?, ?, ?)`
  );
  for (const accId of targets) {
    const platform = accountMap.get(accId);
    if (platform) insertTarget.run(postId, accId, platform);
  }

  db.prepare(
    `INSERT INTO logs (user_id, action, details) VALUES (?, ?, ?)`
  ).run(req.user.id, 'create_post', JSON.stringify({ postId, status }));

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  res.status(201).json({ post });
});

// PUT /api/posts/:id — update konten, media, jadwal (hanya jika belum posted)
router.put('/:id', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!post) return res.status(404).json({ error: 'Postingan tidak ditemukan.' });
  if (post.status === 'posted') {
    return res.status(400).json({ error: 'Postingan sudah terpublish, tidak bisa diedit.' });
  }

  const { title, content, media, scheduled_at, targets } = req.body || {};
  let scheduledAt = post.scheduled_at;
  if (scheduled_at !== undefined) {
    const d = new Date(scheduled_at);
    if (isNaN(d.getTime())) return res.status(400).json({ error: 'Format scheduled_at tidak valid.' });
    scheduledAt = d.toISOString().slice(0, 19).replace('T', ' ');
  }

  db.prepare(
    `UPDATE posts SET title = ?, content = ?, scheduled_at = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(title ?? post.title, content ?? post.content, scheduledAt, post.id);

  if (Array.isArray(media)) {
    db.prepare('DELETE FROM post_media WHERE post_id = ?').run(post.id);
    let sort = 0;
    const insertMedia = db.prepare(
      `INSERT INTO post_media (post_id, media_url, media_type, sort_order) VALUES (?, ?, ?, ?)`
    );
    for (const m of media) {
      if (!m?.url) continue;
      insertMedia.run(post.id, m.url, m.type === 'video' ? 'video' : 'image', sort++);
    }
  }

  if (Array.isArray(targets)) {
    const validAccounts = db
      .prepare('SELECT id, platform FROM social_accounts WHERE user_id = ? AND is_active = 1')
      .all(req.user.id);
    const accountMap = new Map(validAccounts.map((a) => [a.id, a.platform]));
    db.prepare(`DELETE FROM post_targets WHERE post_id = ?`).run(post.id);
    const insertTarget = db.prepare(
      `INSERT INTO post_targets (post_id, account_id, platform) VALUES (?, ?, ?)`
    );
    for (const accId of targets) {
      const platform = accountMap.get(accId);
      if (platform) insertTarget.run(post.id, accId, platform);
    }
  }

  const updated = db.prepare('SELECT * FROM posts WHERE id = ?').get(post.id);
  res.json({ post: updated });
});

// POST /api/posts/:id/publish — publish sekarang / retry
router.post('/:id/publish', async (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!post) return res.status(404).json({ error: 'Postingan tidak ditemukan.' });

  // Reset failed targets agar bisa di-retry
  db.prepare(
    `UPDATE post_targets SET status = 'pending', error_message = NULL WHERE post_id = ? AND status = 'failed'`
  ).run(post.id);

  try {
    const results = await publishPostNow(post.id);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/posts/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM posts WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Postingan tidak ditemukan.' });
  res.json({ success: true });
});

module.exports = router;
