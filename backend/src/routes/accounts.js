const express = require('express');
const { db } = require('../config/firebase');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

// GET /api/accounts
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('social_accounts')
      .where('user_id', '==', req.user.id)
      .get();
      
    const rows = snapshot.docs.map(doc => {
      const data = doc.data();
      const { access_token, ...rest } = data;
      return {
        id: doc.id,
        ...rest,
        has_token: Boolean(access_token)
      };
    });
    
    // Sort by platform locally (Firestore multi-field index can be tricky without setup)
    rows.sort((a, b) => a.platform.localeCompare(b.platform));
    
    res.json({ accounts: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts – manual add (upsert)
router.post('/', async (req, res) => {
  const { platform, page_id, page_name, access_token } = req.body || {};
  if (!['facebook', 'instagram', 'threads'].includes(platform)) {
    return res.status(400).json({ error: 'platform harus facebook, instagram, atau threads.' });
  }
  if (!page_id) return res.status(400).json({ error: 'page_id wajib diisi.' });

  const cleanPageId = String(page_id).trim();

  try {
    const existingSnap = await db.collection('social_accounts')
      .where('user_id', '==', req.user.id)
      .where('platform', '==', platform)
      .where('page_id', '==', cleanPageId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0];
      const updateData = {
        page_name: page_name ? String(page_name).trim() : (existingDoc.data().page_name || null),
        is_active: 1,
        updated_at: new Date().toISOString()
      };
      if (access_token) {
        updateData.access_token = access_token;
      }
      await existingDoc.ref.update(updateData);
      const data = { ...existingDoc.data(), ...updateData };
      const { access_token: _at, ...rest } = data;
      return res.json({ account: { id: existingDoc.id, ...rest, has_token: Boolean(data.access_token) } });
    }

    const newAccount = {
      user_id: req.user.id,
      platform,
      page_id: cleanPageId,
      access_token: access_token || null,
      page_name: page_name ? String(page_name).trim() : null,
      is_active: 1,
      created_at: new Date().toISOString()
    };
    const docRef = await db.collection('social_accounts').add(newAccount);
    
    const { access_token: _at, ...rest } = newAccount;
    res.status(201).json({ account: { id: docRef.id, ...rest, has_token: Boolean(access_token) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/accounts/:id � update token/aktif
router.put('/:id', async (req, res) => {
  try {
    const docRef = db.collection('social_accounts').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }
    
    const account = doc.data();
    const { access_token, page_name, is_active } = req.body || {};
    
    const updateData = {
      access_token: access_token !== undefined ? access_token : account.access_token,
      page_name: page_name !== undefined ? page_name : account.page_name,
      is_active: is_active !== undefined ? (is_active ? 1 : 0) : account.is_active,
    };
    
    await docRef.update(updateData);
    
    const { access_token: _at, ...rest } = { ...account, ...updateData };
    res.json({ account: { id: doc.id, ...rest, has_token: Boolean(updateData.access_token) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/accounts/:id
router.delete('/:id', async (req, res) => {
  try {
    const docRef = db.collection('social_accounts').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }
    
    await docRef.delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts/refresh-tokens – Manual trigger token health check & refresh
const { autoRefreshAllTokens } = require('../services/tokenRefreshService');
router.post('/refresh-tokens', async (req, res) => {
  try {
    const results = await autoRefreshAllTokens();
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
