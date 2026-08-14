const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../config/firebase');
const { signToken, authRequired } = require('../middleware/auth');
const router = express.Router();

function publicUser(docId, data) {
  return { id: docId, name: data.name, email: data.email, created_at: data.created_at };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email, dan password wajib diisi.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter.' });
  }
  const emailLower = String(email).toLowerCase();
  const snapshot = await db.collection('users').where('email', '==', emailLower).limit(1).get();
  
  if (!snapshot.empty) {
    return res.status(409).json({ error: 'Email sudah terdaftar.' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const newUser = {
    name: String(name),
    email: emailLower,
    password_hash: hash,
    created_at: new Date().toISOString()
  };
  
  const docRef = await db.collection('users').add(newUser);
  res.status(201).json({ token: signToken({ id: docRef.id, ...newUser }), user: publicUser(docRef.id, newUser) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email dan password wajib diisi.' });
  }
  const snapshot = await db.collection('users').where('email', '==', String(email).toLowerCase()).limit(1).get();
  
  if (snapshot.empty) {
    return res.status(401).json({ error: 'Email atau password salah.' });
  }
  
  const doc = snapshot.docs[0];
  const user = doc.data();
  
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email atau password salah.' });
  }
  res.json({ token: signToken({ id: doc.id, ...user }), user: publicUser(doc.id, user) });
});

// GET /api/auth/me (Single-user auto fallback)
router.get('/me', async (req, res) => {
  const snapshot = await db.collection('users').orderBy('created_at', 'asc').limit(1).get();
  let user, docId;
  
  if (snapshot.empty) {
    const hash = bcrypt.hashSync('owner1234', 10);
    const newUser = {
      name: 'Owner Medsos',
      email: 'owner@medsos.local',
      password_hash: hash,
      created_at: new Date().toISOString()
    };
    const docRef = await db.collection('users').add(newUser);
    docId = docRef.id;
    user = newUser;
  } else {
    const doc = snapshot.docs[0];
    docId = doc.id;
    user = doc.data();
  }
  res.json({ token: signToken({ id: docId, ...user }), user: publicUser(docId, user) });
});

// GET /api/auth/auto — auto-issue owner token
router.get('/auto', async (req, res) => {
  const snapshot = await db.collection('users').orderBy('created_at', 'asc').limit(1).get();
  let user, docId;
  
  if (snapshot.empty) {
    const hash = bcrypt.hashSync('owner1234', 10);
    const newUser = {
      name: 'Owner Medsos',
      email: 'owner@medsos.local',
      password_hash: hash,
      created_at: new Date().toISOString()
    };
    const docRef = await db.collection('users').add(newUser);
    docId = docRef.id;
    user = newUser;
  } else {
    const doc = snapshot.docs[0];
    docId = doc.id;
    user = doc.data();
  }
  res.json({ token: signToken({ id: docId, ...user }), user: publicUser(docId, user) });
});

module.exports = router;
