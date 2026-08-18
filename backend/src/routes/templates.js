const express = require('express');
const { db } = require('../config/firebase');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

// GET /api/templates
router.get('/', async (req, res) => {
  try {
    const [snapUser, snapAgent] = await Promise.all([
      db.collection('templates').where('user_id', '==', req.user.id).get(),
      db.collection('post_templates').get(),
    ]);

    const userRows = snapUser.docs.map(doc => ({ id: doc.id, ...doc.data(), is_custom: true }));
    const agentRows = snapAgent.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name || 'AI Template',
        content: d.structure || d.content || '',
        category: d.category || 'Universal',
        angle: d.angle || 'General',
        is_ai_template: true,
        created_at: d.created_at || new Date().toISOString()
      };
    });

    // Merge and deduplicate by id
    const map = new Map();
    [...agentRows, ...userRows].forEach(item => map.set(item.id, item));
    const allTemplates = Array.from(map.values());
    allTemplates.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    res.json({ templates: allTemplates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/templates
router.post('/', async (req, res) => {
  try {
    const { name, content, category, angle } = req.body || {};
    if (!name || !content) return res.status(400).json({ error: 'name dan content wajib diisi.' });
    
    const now = new Date().toISOString();
    const newTemplate = {
      user_id: req.user.id,
      name: String(name),
      content: String(content),
      category: category || 'Universal',
      created_at: now,
      updated_at: now
    };
    
    const docRef = await db.collection('templates').add(newTemplate);

    // Sync ke post_templates agar AI Agent bisa langsung memakai template buatan user
    await db.collection('post_templates').doc(docRef.id).set({
      id: docRef.id,
      user_id: req.user.id,
      name: String(name),
      structure: String(content),
      category: category || 'Universal',
      angle: angle || 'Custom User Template',
      is_active: true,
      platform_fit: ['facebook', 'instagram', 'threads'],
      segment_performance: {},
      created_at: now,
      updated_at: now
    });

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
