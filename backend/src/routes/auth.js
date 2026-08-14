const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../config/firebase');
const { signToken, authRequired } = require('../middleware/auth');
const router = express.Router();

function publicUser(docId, data) {
  return { id: docId, name: data.name || 'Owner', email: data.email, created_at: data.created_at };
}

// POST /api/auth/login - Hanya untuk pemilik akun terdaftar
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi.' });
    }

    const emailLower = String(email).trim().toLowerCase();
    const cleanPassword = String(password).trim();

    // Cek di database
    const snapshot = await db.collection('users').where('email', '==', emailLower).limit(1).get();

    if (snapshot.empty) {
      // Jika akun owner pertama kali login
      if (emailLower === 'sr7aron@gmail.com' && cleanPassword === 'koderahasiaaron7799') {
        const hash = bcrypt.hashSync(cleanPassword, 10);
        const newUser = {
          name: 'Aron',
          email: emailLower,
          password_hash: hash,
          created_at: new Date().toISOString()
        };
        const docRef = await db.collection('users').add(newUser);
        return res.json({ token: signToken({ id: docRef.id, ...newUser }), user: publicUser(docRef.id, newUser) });
      }
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    const doc = snapshot.docs[0];
    const user = doc.data();

    // Verifikasi password atau sinkronisasi jika owner
    const isValid = bcrypt.compareSync(cleanPassword, user.password_hash);
    if (!isValid) {
      if (emailLower === 'sr7aron@gmail.com' && cleanPassword === 'koderahasiaaron7799') {
        const newHash = bcrypt.hashSync(cleanPassword, 10);
        await db.collection('users').doc(doc.id).update({ password_hash: newHash });
        return res.json({ token: signToken({ id: doc.id, ...user, password_hash: newHash }), user: publicUser(doc.id, user) });
      }
      return res.status(401).json({ error: 'Email atau password salah.' });
    }

    res.json({ token: signToken({ id: doc.id, ...user }), user: publicUser(doc.id, user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan sistem: ' + err.message });
  }
});

// GET /api/auth/me - Verifikasi sesi token (Wajib Token Valid)
router.get('/me', authRequired, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.user.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
    }
    const user = doc.data();
    res.json({ user: publicUser(doc.id, user) });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memverifikasi sesi.' });
  }
});

// Tutup registrasi publik
router.post('/register', (req, res) => {
  res.status(403).json({ error: 'Registrasi akun publik dinonaktifkan.' });
});

module.exports = router;