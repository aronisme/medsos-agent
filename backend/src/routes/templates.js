const express = require('express');
const { db } = require('../config/firebase');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

// GET /api/templates
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('templates')
      .where('user_id', '==', req.user.id)
      .orderBy('created_at', 'desc')
      .get();
    const rows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ templates: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/templates
router.post('/', async (req, res) => {
  try {
    const { name, content } = req.body || {};
    if (!name || !content) return res.status(400).json({ error: 'name dan content wajib diisi.' });
    
    const newTemplate = {
      user_id: req.user.id,
      name: String(name),
      content: String(content),
      created_at: new Date().toISOString()
    };
    
    const docRef = await db.collection('templates').add(newTemplate);
    res.status(201).json({ template: { id: docRef.id, ...newTemplate } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/templates/:id
router.put('/:id', async (req, res) => {
  try {
    const docRef = db.collection('templates').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ error: 'Template tidak ditemukan.' });
    }
    
    const existing = doc.data();
    const { name, content } = req.body || {};
    const updateData = {
      name: name ?? existing.name,
      content: content ?? existing.content
    };
    
    await docRef.update(updateData);
    res.json({ template: { id: doc.id, ...existing, ...updateData } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', async (req, res) => {
  try {
    const docRef = db.collection('templates').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ error: 'Template tidak ditemukan.' });
    }
    
    await docRef.delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
