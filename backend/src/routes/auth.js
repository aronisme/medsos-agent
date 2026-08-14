const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, authRequired } = require('../middleware/auth');
const router = express.Router();

function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, created_at: row.created_at };
}

// POST /api/auth/register
router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, dan password wajib diisi.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Email sudah terdaftar.' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)'
  ).run(String(name), String(email).toLowerCase(), hash);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email dan password wajib diisi.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email atau password salah.' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/me (Single-user auto fallback)
router.get('/me', (req, res) => {
  let user = db.prepare('SELECT * FROM users ORDER BY id ASC LIMIT 1').get();
  if (!user) {
    const hash = bcrypt.hashSync('owner1234', 10);
    const r = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('Owner Medsos', 'owner@medsos.local', hash);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/auto — auto-issue owner token
router.get('/auto', (req, res) => {
  let user = db.prepare('SELECT * FROM users ORDER BY id ASC LIMIT 1').get();
  if (!user) {
    const hash = bcrypt.hashSync('owner1234', 10);
    const r = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run('Owner Medsos', 'owner@medsos.local', hash);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

module.exports = router;
