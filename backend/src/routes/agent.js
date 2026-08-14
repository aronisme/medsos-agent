const express = require('express');
const { db } = require('../config/firebase');
const { authRequired } = require('../middleware/auth');
const { publishPostNow } = require('../services/postService');
const { generateCaption } = require('../services/aiService');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const env = require('../config/env');
const router = express.Router();

router.use(authRequired);

router.post('/execute', async (req, res) => {
  const { action, params = {} } = req.body || {};
  const uid = req.user.id;

  if (!action) {
    return res.status(400).json({ error: 'Field "action" wajib diisi.' });
  }

  try {
    switch (action) {
      case 'get_accounts': {
        const snapshot = await db.collection('social_accounts')
          .where('user_id', '==', uid)
          .where('is_active', '==', 1)
          .get();
        const accounts = snapshot.docs.map(doc => {
          const { access_token, ...rest } = doc.data();
          return { id: doc.id, ...rest, has_token: Boolean(access_token) };
        });
        return res.json({ success: true, data: accounts });
      }

      case 'get_posts': {
        const { status, limit = 50 } = params;
        let query = db.collection('posts').where('user_id', '==', uid);
        if (status) query = query.where('status', '==', status);
        query = query.orderBy('created_at', 'desc').limit(parseInt(limit, 10) || 50);
        
        const snapshot = await query.get();
        const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.json({ success: true, data: posts });
      }

      case 'create_post': {
        const { title, content, media = [], targets = [], scheduled_at, post_type = 'feed' } = params;
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
        const formattedMedia = media.filter(m => m?.url).map((m, i) => ({
          url: m.url,
          type: m.type === 'video' ? 'video' : 'image',
          sort_order: i
        }));

        const validAccountsSnap = await db.collection('social_accounts')
          .where('user_id', '==', uid)
          .where('is_active', '==', 1)
          .get();
          
        const accountMap = new Map();
        validAccountsSnap.forEach(doc => accountMap.set(doc.id, doc.data()));

        const formattedTargets = targets.map(accId => {
          const acc = accountMap.get(accId);
          if (!acc) return null;
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

        const newPost = {
          user_id: uid,
          title: title || null,
          content: String(content).trim(),
          status,
          scheduled_at: scheduledAt,
          post_type: post_type === 'reel' ? 'reel' : 'feed',
          media: formattedMedia,
          targets: formattedTargets,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const docRef = await db.collection('posts').add(newPost);
        await db.collection('logs').add({
          user_id: uid,
          action: 'agent_create_post',
          details: JSON.stringify({ postId: docRef.id, status }),
          created_at: new Date().toISOString()
        });

        return res.json({ success: true, data: { id: docRef.id, ...newPost } });
      }

      case 'update_post': {
        const { post_id, title, content, media, scheduled_at, targets } = params;
        if (!post_id) return res.status(400).json({ error: 'post_id wajib diisi.' });

        const docRef = db.collection('posts').doc(post_id);
        const doc = await docRef.get();
        if (!doc.exists || doc.data().user_id !== uid) {
          return res.status(404).json({ error: 'Postingan tidak ditemukan.' });
        }

        const post = doc.data();
        if (post.status === 'posted') {
          return res.status(400).json({ error: 'Postingan sudah terpublish, tidak bisa diedit.' });
        }

        let scheduledAt = post.scheduled_at;
        if (scheduled_at !== undefined) {
          if (scheduled_at) {
            const d = new Date(scheduled_at);
            if (isNaN(d.getTime())) return res.status(400).json({ error: 'Format scheduled_at tidak valid.' });
            scheduledAt = d.toISOString();
          } else {
            scheduledAt = null;
          }
        }

        const updateData = {
          title: title ?? post.title,
          content: content ?? post.content,
          scheduled_at: scheduledAt,
          status: scheduledAt ? 'scheduled' : 'draft',
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
            .where('user_id', '==', uid)
            .where('is_active', '==', 1)
            .get();
          const accountMap = new Map();
          validAccountsSnap.forEach(doc => accountMap.set(doc.id, doc.data()));

          updateData.targets = targets.map(accId => {
            const acc = accountMap.get(accId);
            if (!acc) return null;
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
        return res.json({ success: true, data: { id: doc.id, ...post, ...updateData } });
      }

      case 'publish_post': {
        const { post_id } = params;
        if (!post_id) return res.status(400).json({ error: 'post_id wajib diisi.' });

        const docRef = db.collection('posts').doc(post_id);
        const doc = await docRef.get();
        if (!doc.exists || doc.data().user_id !== uid) {
          return res.status(404).json({ error: 'Postingan tidak ditemukan.' });
        }

        const post = doc.data();
        let targetsUpdated = false;
        const newTargets = (post.targets || []).map(t => {
          if (t.status === 'failed') {
            targetsUpdated = true;
            return { ...t, status: 'pending', error_message: null };
          }
          return t;
        });

        if (targetsUpdated) await docRef.update({ targets: newTargets });

        const results = await publishPostNow(doc.id);
        return res.json({ success: true, data: results });
      }

      case 'delete_post': {
        const { post_id } = params;
        if (!post_id) return res.status(400).json({ error: 'post_id wajib diisi.' });

        const docRef = db.collection('posts').doc(post_id);
        const doc = await docRef.get();
        if (!doc.exists || doc.data().user_id !== uid) {
          return res.status(404).json({ error: 'Postingan tidak ditemukan.' });
        }

        await docRef.delete();
        return res.json({ success: true });
      }

      case 'upload_media': {
        const { file_base64, file_name, mime_type } = params;
        if (!file_base64 || !file_name) {
          return res.status(400).json({ error: 'file_base64 dan file_name wajib diisi.' });
        }

        // Clean up base64 string if it contains data uri prefix
        let base64Data = file_base64;
        if (base64Data.includes('base64,')) {
          base64Data = base64Data.split('base64,')[1];
        }

        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const ext = path.extname(file_name) || (mime_type?.includes('video') ? '.mp4' : '.jpg');
        const hash = crypto.randomBytes(8).toString('hex');
        const finalFileName = `${Date.now()}-${hash}${ext}`;
        const filePath = path.join(uploadDir, finalFileName);

        fs.writeFileSync(filePath, base64Data, 'base64');
        const url = `${env.baseUrl}/uploads/${finalFileName}`;

        return res.json({ 
          success: true, 
          data: { 
            url, 
            type: mime_type?.includes('video') ? 'video' : 'image' 
          } 
        });
      }

      case 'get_templates': {
        const snapshot = await db.collection('templates')
          .where('user_id', '==', uid)
          .orderBy('created_at', 'desc')
          .get();
        const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.json({ success: true, data: templates });
      }

      case 'generate_caption': {
        const { topic, tone, platform, length } = params;
        if (!topic || !String(topic).trim()) {
          return res.status(400).json({ error: 'topic wajib diisi.' });
        }
        
        try {
          const caption = await generateCaption({ topic: String(topic), tone, platform, length });
          const cleanTopic = String(topic).trim();
          const title = cleanTopic.length > 40 ? cleanTopic.slice(0, 40) + '...' : cleanTopic;
          return res.json({ success: true, data: { caption, title } });
        } catch (e) {
          const message = e?.response?.data?.message || e.message;
          return res.status(500).json({ error: `Gagal generate caption: ${message}` });
        }
      }

      case 'get_stats': {
        const postsSnap = await db.collection('posts')
          .where('user_id', '==', uid)
          .get();
          
        const summary = { draft: 0, scheduled: 0, posted: 0, failed: 0 };
        postsSnap.docs.forEach((doc) => {
          const p = doc.data();
          if (summary[p.status] !== undefined) summary[p.status]++;
        });

        return res.json({ success: true, data: { summary } });
      }

      default:
        return res.status(400).json({ error: `Action '${action}' tidak dikenali.` });
    }
  } catch (err) {
    console.error(`[Agent Action Error] ${action}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
