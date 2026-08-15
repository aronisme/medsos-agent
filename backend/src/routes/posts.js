const express = require('express');
const { db } = require('../config/firebase');
const { authRequired } = require('../middleware/auth');
const { publishPostNow } = require('../services/postService');
const router = express.Router();

router.use(authRequired);

// GET /api/posts?status=draft|scheduled|posted|failed&limit=20
router.get('/', async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    let query = db.collection('posts').where('user_id', '==', req.user.id);
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    const snapshot = await query.get();
    let posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    posts.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    const parsedLimit = parseInt(limit, 10) || 50;
    posts = posts.slice(0, parsedLimit);
    
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/posts/:id (media + targets are embedded)
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('posts').doc(req.params.id).get();
    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ error: 'Postingan tidak ditemukan.' });
    }
    const data = doc.data();
    res.json({ post: { id: doc.id, ...data, media: data.media || [], targets: data.targets || [] } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts — create (draft | scheduled)
router.post('/', async (req, res) => {
  try {
    const { title, content, media = [], targets = [], scheduled_at, post_type = 'feed' } = req.body || {};
    if (!content || !String(content).trim()) {
      return res.status(400).json({ error: 'Konten postingan wajib diisi.' });
    }

    let scheduledAt = null;
    if (scheduled_at) {
      const d = new Date(scheduled_at);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'Format scheduled_at tidak valid.' });
      if (d.getTime() <= Date.now()) return res.status(400).json({ error: 'Waktu jadwal harus di masa depan.' });
      scheduledAt = d.toISOString();
    }

    const status = scheduledAt ? 'scheduled' : 'draft';
    const cleanPostType = post_type === 'reel' ? 'reel' : 'feed';

    // Format Media
    const formattedMedia = media.filter(m => m?.url).map((m, i) => ({
      url: m.url,
      type: m.type === 'video' ? 'video' : 'image',
      sort_order: i
    }));

    // Resolve valid accounts for targets
    const validAccountsSnap = await db.collection('social_accounts')
      .where('user_id', '==', req.user.id)
      .where('is_active', '==', 1)
      .get();
      
    const accountMap = new Map();
    validAccountsSnap.forEach(doc => accountMap.set(doc.id, doc.data()));

    const formattedTargets = targets.map(accId => {
      const acc = accountMap.get(accId);
      if (!acc) return null;
      return {
        id: Math.random().toString(36).substring(2, 9), // generate temporary unique ID for array elements
        account_id: accId,
        platform: acc.platform,
        page_name: acc.page_name,
        status: 'pending',
        error_message: null,
        attempt_count: 0
      };
    }).filter(Boolean);

    const newPost = {
      user_id: req.user.id,
      title: title || null,
      content: String(content).trim(),
      status,
      scheduled_at: scheduledAt,
      post_type: cleanPostType,
      media: formattedMedia,
      targets: formattedTargets,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const docRef = await db.collection('posts').add(newPost);
    
    // Log
    await db.collection('logs').add({
      user_id: req.user.id,
      action: 'create_post',
      details: JSON.stringify({ postId: docRef.id, status }),
      created_at: new Date().toISOString()
    });

    res.status(201).json({ post: { id: docRef.id, ...newPost } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/posts/:id — update konten, media, jadwal
router.put('/:id', async (req, res) => {
  try {
    const docRef = db.collection('posts').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ error: 'Postingan tidak ditemukan.' });
    }
    
    const post = doc.data();
    if (post.status === 'posted') {
      return res.status(400).json({ error: 'Postingan sudah terpublish, tidak bisa diedit.' });
    }

    const { title, content, media, scheduled_at, targets } = req.body || {};
    let scheduledAt = post.scheduled_at;
    if (scheduled_at !== undefined) {
      const d = new Date(scheduled_at);
      if (isNaN(d.getTime())) return res.status(400).json({ error: 'Format scheduled_at tidak valid.' });
      scheduledAt = d.toISOString();
    }

    const updateData = {
      title: title ?? post.title,
      content: content ?? post.content,
      scheduled_at: scheduledAt,
      updated_at: new Date().toISOString()
    };

    if (Array.isArray(media)) {
      updateData.media = media.filter(m => m?.url).map((m, i) => ({
        url: m.url,
        type: m.type === 'video' ? 'video' : 'image',
        sort_order: i
      }));
    }

    if (Array.isArray(targets)) {
      const validAccountsSnap = await db.collection('social_accounts')
        .where('user_id', '==', req.user.id)
        .where('is_active', '==', 1)
        .get();
      const accountMap = new Map();
      validAccountsSnap.forEach(doc => accountMap.set(doc.id, doc.data()));

      updateData.targets = targets.map(accId => {
        const acc = accountMap.get(accId);
        if (!acc) return null;
        // Keep existing target state if already existed
        const existing = (post.targets || []).find(t => t.account_id === accId);
        if (existing) return existing;
        
        return {
          id: Math.random().toString(36).substring(2, 9),
          account_id: accId,
          platform: acc.platform,
          page_name: acc.page_name,
          status: 'pending',
          error_message: null,
          attempt_count: 0
        };
      }).filter(Boolean);
    }

    await docRef.update(updateData);
    res.json({ post: { id: doc.id, ...post, ...updateData } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/posts/:id/publish — publish sekarang / retry
router.post('/:id/publish', async (req, res) => {
  try {
    const docRef = db.collection('posts').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ error: 'Postingan tidak ditemukan.' });
    }

    // Reset failed targets
    const post = doc.data();
    let targetsUpdated = false;
    const newTargets = (post.targets || []).map(t => {
      if (t.status === 'failed') {
        targetsUpdated = true;
        return { ...t, status: 'pending', error_message: null };
      }
      return t;
    });

    if (targetsUpdated) {
      await docRef.update({ targets: newTargets });
    }

    const results = await publishPostNow(doc.id);
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/posts/:id
router.delete('/:id', async (req, res) => {
  try {
    const docRef = db.collection('posts').doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ error: 'Postingan tidak ditemukan.' });
    }
    
    await docRef.delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
