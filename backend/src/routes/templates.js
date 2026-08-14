const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

// GET /api/templates
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM templates WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ templates: rows });
});

// POST /api/templates
router.post('/', (req, res) => {
  const { name, content } = req.body || {};
  if (!name || !content) return res.status(400).json({ error: 'name dan content wajib diisi.' });
  const result = db
    .prepare('INSERT INTO templates (user_id, name, content) VALUES (?, ?, ?)')
    .run(req.user.id, String(name), String(content));
  const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ template });
});

// PUT /api/templates/:id
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM templates WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: 'Template tidak ditemukan.' });
  const { name, content } = req.body || {};
  db.prepare('UPDATE templates SET name = ?, content = ? WHERE id = ?').run(
    name ?? existing.name,
    content ?? existing.content,
    existing.id
  );
  const updated = db.prepare('SELECT * FROM templates WHERE id = ?').get(existing.id);
  res.json({ template: updated });
});

// DELETE /api/templates/:id
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM templates WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Template tidak ditemukan.' });
  res.json({ success: true });
});

module.exports = router;
