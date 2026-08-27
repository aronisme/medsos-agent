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
      db.collection('post_templates').where('is_active', '==', true).get(),
    ]);

    const userRows = snapUser.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title || d.name || 'Template Caption',
        name: d.name || d.title || 'Template Caption',
        content: d.content || d.structure || '',
        category: d.category || 'Universal',
        angle: d.angle || 'General',
        is_custom: true,
        created_at: d.created_at || new Date().toISOString()
      };
    });

    const agentRows = snapAgent.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.name || d.title || 'AI Strategy Template',
        name: d.name || d.title || 'AI Strategy Template',
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
    const { name, title, content, category, angle } = req.body || {};
    const finalName = name || title;
    if (!finalName || !content) return res.status(400).json({ error: 'Judul dan isi template wajib diisi.' });
    
    const now = new Date().toISOString();
    const newTemplate = {
      user_id: req.user.id,
      name: String(finalName),
      title: String(finalName),
      content: String(content),
      category: category || 'Universal',
      created_at: now,
      updated_at: now
    };
    
    const docRef = await db.collection('templates').add(newTemplate);

    // Sync ke post_templates agar AI Agent juga bisa memakainya
    await db.collection('post_templates').doc(docRef.id).set({
      id: docRef.id,
      user_id: req.user.id,
      name: String(finalName),
      title: String(finalName),
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
    const templateId = req.params.id;
    const { name, title, content, category, angle } = req.body || {};
    const finalName = name || title;

    let updated = false;

    // 1. Cek di collection templates
    const userDocRef = db.collection('templates').doc(templateId);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      const existing = userDoc.data();
      const updateData = {
        name: finalName ?? existing.name ?? existing.title,
        title: finalName ?? existing.title ?? existing.name,
        content: content ?? existing.content,
        updated_at: new Date().toISOString()
      };
      await userDocRef.update(updateData);
      updated = true;
    }

    // 2. Cek di collection post_templates
    const agentDocRef = db.collection('post_templates').doc(templateId);
    const agentDoc = await agentDocRef.get();
    if (agentDoc.exists) {
      const existing = agentDoc.data();
      const updateData = {
        name: finalName ?? existing.name ?? existing.title,
        title: finalName ?? existing.title ?? existing.name,
        structure: content ?? existing.structure ?? existing.content,
        category: category ?? existing.category ?? 'Universal',
        angle: angle ?? existing.angle ?? 'General',
        updated_at: new Date().toISOString()
      };
      await agentDocRef.update(updateData);
      updated = true;
    }

    if (!updated) {
      return res.status(404).json({ error: 'Template tidak ditemukan.' });
    }

    res.json({ success: true, message: 'Template berhasil diperbarui.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', async (req, res) => {
  try {
    const templateId = req.params.id;
    let deleted = false;

    // 1. Hapus dari collection templates (user custom)
    const userDocRef = db.collection('templates').doc(templateId);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      await userDocRef.delete();
      deleted = true;
    }

    // 2. Hapus atau nonaktifkan dari collection post_templates (agent & custom synced)
    const agentDocRef = db.collection('post_templates').doc(templateId);
    const agentDoc = await agentDocRef.get();
    if (agentDoc.exists) {
      // Hapus dokumen atau tandai is_active: false
      await agentDocRef.delete();
      deleted = true;
    }

    if (!deleted) {
      return res.status(404).json({ error: 'Template tidak ditemukan.' });
    }

    res.json({ success: true, message: 'Template berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
