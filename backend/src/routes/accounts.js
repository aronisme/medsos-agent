const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

// GET /api/accounts
router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM social_accounts WHERE user_id = ? ORDER BY platform, id')
    .all(req.user.id)
    .map(({ access_token, ...rest }) => ({
      ...rest,
      has_token: Boolean(access_token),
    }));
  res.json({ accounts: rows });
});

// POST /api/accounts — manual add (untuk dev; OAuth di routes/auth-oauth.js)
// body: { platform: 'facebook'|'instagram', page_id, page_name?, access_token? }
router.post('/', (req, res) => {
  const { platform, page_id, page_name, access_token } = req.body || {};
  if (!['facebook', 'instagram'].includes(platform)) {
    return res.status(400).json({ error: 'platform harus facebook atau instagram.' });
  }
  if (!page_id) return res.status(400).json({ error: 'page_id wajib diisi.' });

  const result = db.prepare(
    `INSERT INTO social_accounts (user_id, platform, page_id, access_token, page_name, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`
  ).run(req.user.id, platform, String(page_id), access_token || null, page_name || null);

  const clean = db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(result.lastInsertRowid);
  const { access_token: _at, ...rest } = clean;
  res.status(201).json({ account: { ...rest, has_token: Boolean(clean.access_token) } });
});

// PUT /api/accounts/:id — update token/aktif
router.put('/:id', (req, res) => {
  const account = db
    .prepare('SELECT * FROM social_accounts WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  if (!account) return res.status(404).json({ error: 'Akun tidak ditemukan.' });

  const { access_token, page_name, is_active } = req.body || {};
  db.prepare(
    `UPDATE social_accounts SET access_token = ?, page_name = ?, is_active = ? WHERE id = ?`
  ).run(
    access_token !== undefined ? access_token : account.access_token,
    page_name !== undefined ? page_name : account.page_name,
    is_active !== undefined ? (is_active ? 1 : 0) : account.is_active,
    account.id
  );

  const updated = db.prepare('SELECT * FROM social_accounts WHERE id = ?').get(account.id);
  const { access_token: _at, ...rest } = updated;
  res.json({ account: { ...rest, has_token: Boolean(updated.access_token) } });
});

// DELETE /api/accounts/:id
router.delete('/:id', (req, res) => {
  const result = db
    .prepare('DELETE FROM social_accounts WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Akun tidak ditemukan.' });
  res.json({ success: true });
});

module.exports = router;
