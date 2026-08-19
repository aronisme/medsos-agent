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

// Helper function to sanitize parameters for logging (prevents storing massive base64 in Firestore)
function sanitizeParams(params) {
  if (!params || typeof params !== 'object') return params;
  const sanitized = { ...params };
  if (sanitized.file_base64) {
    sanitized.file_base64 = `[BASE64_DATA: ${sanitized.file_base64.length} chars]`;
  }
  return sanitized;
}

// Helper function to record agent activity log
async function logAgentActivity({ uid, action, params, status, result, error, req }) {
  try {
    const ip = req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || 'unknown';
    const userAgent = req?.headers?.['user-agent'] || 'unknown';
    
    const logData = {
      user_id: uid,
      action: action || 'unknown',
      params: sanitizeParams(params),
      status: status || 'success', // 'success' | 'failed'
      result: result || null,
      error: error || null,
      ip: String(ip).split(',')[0].trim(),
      user_agent: userAgent,
      created_at: new Date().toISOString()
    };

    await db.collection('agent_logs').add(logData);
  } catch (err) {
    console.error('[logAgentActivity Error]:', err.message);
  }
}

// GET /api/agent/logs - Fetch recent agent API call history
router.get('/logs', async (req, res) => {
  try {
    const uid = req.user.id;
    const { limit = 50, action, status } = req.query;
    
    let query = db.collection('agent_logs')
      .where('user_id', '==', uid);

    if (action) {
      query = query.where('action', '==', action);
    }
    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    let logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Sort in-memory by created_at desc to avoid requiring composite indexes
    logs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    logs = logs.slice(0, parseInt(limit, 10) || 50);

    res.json({ success: true, logs });
  } catch (err) {
    console.error('[GET /agent/logs Error]:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/execute - Unified execute endpoint
router.post('/execute', async (req, res) => {
  const { action, params = {} } = req.body || {};
  const uid = req.user.id;

  if (!action) {
    await logAgentActivity({
      uid,
      action: 'unknown',
      params,
      status: 'failed',
      error: 'Field "action" wajib diisi.',
      req
    });
    return res.status(400).json({ error: 'Field "action" wajib diisi.' });
  }

  try {
    switch (action) {
      case 'get_accounts': {
        const snapshot = await db.collection('social_accounts')
          .where('user_id', '==', uid)
          .where('is_active', 'in', [1, true, '1'])
          .get();
        const accounts = snapshot.docs.map(doc => {
          const { access_token, ...rest } = doc.data();
          return { id: doc.id, ...rest, has_token: Boolean(access_token) };
        });

        await logAgentActivity({
          uid,
          action,
          params,
          status: 'success',
          result: { count: accounts.length, accounts: accounts.map(a => ({ id: a.id, name: a.page_name, platform: a.platform })) },
          req
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

        await logAgentActivity({
          uid,
          action,
          params,
          status: 'success',
          result: { count: posts.length },
          req
        });

        return res.json({ success: true, data: posts });
      }

      case 'create_post': {
        const { title, content, media = [], targets = [], scheduled_at, post_type = 'feed' } = params;
        if (!content || !String(content).trim()) {
          await logAgentActivity({
            uid,
            action,
            params,
            status: 'failed',
            error: 'Konten postingan wajib diisi.',
            req
          });
          return res.status(400).json({ error: 'Konten postingan wajib diisi.' });
        }

        let scheduledAt = null;
        if (scheduled_at) {
          const d = new Date(scheduled_at);
          if (isNaN(d.getTime())) {
            await logAgentActivity({
              uid,
              action,
              params,
              status: 'failed',
              error: 'Format scheduled_at tidak valid.',
              req
            });
            return res.status(400).json({ error: 'Format scheduled_at tidak valid.' });
          }
          if (d.getTime() <= Date.now()) {
            await logAgentActivity({
              uid,
              action,
              params,
              status: 'failed',
              error: 'Waktu jadwal harus di masa depan.',
              req
            });
            return res.status(400).json({ error: 'Waktu jadwal harus di masa depan.' });
          }
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
          .where('is_active', 'in', [1, true, '1'])
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
        
        await logAgentActivity({
          uid,
          action,
          params,
          status: 'success',
          result: {
            postId: docRef.id,
            title: newPost.title,
            post_status: status,
            scheduled_at: scheduledAt,
            target_count: formattedTargets.length,
            media_count: formattedMedia.length
          },
          req
        });

        return res.json({ success: true, data: { id: docRef.id, ...newPost } });
      }

      case 'update_post': {
        const { post_id, title, content, media, scheduled_at, targets } = params;
        if (!post_id) {
          await logAgentActivity({ uid, action, params, status: 'failed', error: 'post_id wajib diisi.', req });
          return res.status(400).json({ error: 'post_id wajib diisi.' });
        }

        const docRef = db.collection('posts').doc(post_id);
        const doc = await docRef.get();
        if (!doc.exists || doc.data().user_id !== uid) {
          await logAgentActivity({ uid, action, params, status: 'failed', error: 'Postingan tidak ditemukan.', req });
          return res.status(404).json({ error: 'Postingan tidak ditemukan.' });
        }

        const post = doc.data();
        if (post.status === 'posted') {
          await logAgentActivity({ uid, action, params, status: 'failed', error: 'Postingan sudah terpublish, tidak bisa diedit.', req });
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
            .where('is_active', 'in', [1, true, '1'])
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

        await logAgentActivity({
          uid,
          action,
          params,
          status: 'success',
          result: { postId: doc.id, updatedFields: Object.keys(updateData) },
          req
        });

        return res.json({ success: true, data: { id: doc.id, ...post, ...updateData } });
      }

      case 'publish_post': {
        const { post_id } = params;
        if (!post_id) {
          await logAgentActivity({ uid, action, params, status: 'failed', error: 'post_id wajib diisi.', req });
          return res.status(400).json({ error: 'post_id wajib diisi.' });
        }

        const docRef = db.collection('posts').doc(post_id);
        const doc = await docRef.get();
        if (!doc.exists || doc.data().user_id !== uid) {
          await logAgentActivity({ uid, action, params, status: 'failed', error: 'Postingan tidak ditemukan.', req });
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

        await logAgentActivity({
          uid,
          action,
          params,
          status: 'success',
          result: { postId: doc.id, publishResults: results },
          req
        });

        return res.json({ success: true, data: results });
      }

      case 'delete_post': {
        const { post_id } = params;
        if (!post_id) {
          await logAgentActivity({ uid, action, params, status: 'failed', error: 'post_id wajib diisi.', req });
          return res.status(400).json({ error: 'post_id wajib diisi.' });
        }

        const docRef = db.collection('posts').doc(post_id);
        const doc = await docRef.get();
        if (!doc.exists || doc.data().user_id !== uid) {
          await logAgentActivity({ uid, action, params, status: 'failed', error: 'Postingan tidak ditemukan.', req });
          return res.status(404).json({ error: 'Postingan tidak ditemukan.' });
        }

        await docRef.delete();

        await logAgentActivity({
          uid,
          action,
          params,
          status: 'success',
          result: { postId: post_id, deleted: true },
          req
        });

        return res.json({ success: true });
      }

      case 'upload_media': {
        const { file_base64, file_name = 'upload.jpg', mime_type } = params;
        if (!file_base64) {
          await logAgentActivity({ uid, action, params, status: 'failed', error: 'file_base64 wajib diisi.', req });
          return res.status(400).json({ error: 'file_base64 wajib diisi.' });
        }

        let base64Data = String(file_base64).trim();
        if (base64Data.includes('base64,')) {
          base64Data = base64Data.split('base64,')[1];
        }

        const isVideo = mime_type?.includes('video') || String(file_name).endsWith('.mp4');
        const cloudName = isVideo ? (process.env.CLOUDINARY_CLOUD_NAME_VIDEO || 'drkbqpxqf') : (process.env.CLOUDINARY_CLOUD_NAME_IMAGE || 'dwgfox722');
        const uploadPreset = isVideo ? (process.env.CLOUDINARY_UPLOAD_PRESET_VIDEO || 'vidgram') : (process.env.CLOUDINARY_UPLOAD_PRESET_IMAGE || 'lynke_app');
        const cleanMime = mime_type || (isVideo ? 'video/mp4' : 'image/jpeg');

        const formData = new URLSearchParams();
        formData.append('file', `data:${cleanMime};base64,${base64Data}`);
        formData.append('upload_preset', uploadPreset);

        const resourceType = isVideo ? 'video' : 'image';
        const cloudRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
          method: 'POST',
          body: formData
        });

        const cloudData = await cloudRes.json();

        if (!cloudRes.ok) {
          const errorMsg = cloudData.error?.message || 'Gagal upload media ke Cloudinary';
          await logAgentActivity({ uid, action, params, status: 'failed', error: errorMsg, req });
          return res.status(500).json({ error: errorMsg });
        }

        const uploadResult = { 
          url: cloudData.secure_url || cloudData.url, 
          type: resourceType,
          public_id: cloudData.public_id,
          format: cloudData.format
        };

        await logAgentActivity({
          uid,
          action,
          params,
          status: 'success',
          result: { fileName: file_name, url: uploadResult.url, type: uploadResult.type },
          req
        });

        return res.json({ success: true, data: uploadResult });
      }

      case 'get_templates': {
        const snapshot = await db.collection('templates')
          .where('user_id', '==', uid)
          .orderBy('created_at', 'desc')
          .get();
        const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        await logAgentActivity({
          uid,
          action,
          params,
          status: 'success',
          result: { count: templates.length },
          req
        });

        return res.json({ success: true, data: templates });
      }

      case 'generate_caption': {
        const { topic, tone, platform, length } = params;
        if (!topic || !String(topic).trim()) {
          await logAgentActivity({ uid, action, params, status: 'failed', error: 'topic wajib diisi.', req });
          return res.status(400).json({ error: 'topic wajib diisi.' });
        }
        
        try {
          const caption = await generateCaption({ topic: String(topic), tone, platform, length });
          const cleanTopic = String(topic).trim();
          const title = cleanTopic.length > 40 ? cleanTopic.slice(0, 40) + '...' : cleanTopic;

          await logAgentActivity({
            uid,
            action,
            params,
            status: 'success',
            result: { title, captionPreview: caption.slice(0, 80) + '...' },
            req
          });

          return res.json({ success: true, data: { caption, title } });
        } catch (e) {
          const message = e?.response?.data?.message || e.message;
          await logAgentActivity({ uid, action, params, status: 'failed', error: message, req });
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

        await logAgentActivity({
          uid,
          action,
          params,
          status: 'success',
          result: { summary },
          req
        });

        return res.json({ success: true, data: { summary } });
      }

      case 'get_agent_logs': {
        const { limit = 50, filter_status } = params;
        let query = db.collection('agent_logs').where('user_id', '==', uid);
        if (filter_status) query = query.where('status', '==', filter_status);

        const snapshot = await query.get();
        let logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        logs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        logs = logs.slice(0, parseInt(limit, 10) || 50);

        return res.json({ success: true, data: logs });
      }

      default:
        await logAgentActivity({
          uid,
          action,
          params,
          status: 'failed',
          error: `Action '${action}' tidak dikenali.`,
          req
        });
        return res.status(400).json({ error: `Action '${action}' tidak dikenali.` });
    }
  } catch (err) {
    console.error(`[Agent Action Error] ${action}:`, err.message);
    await logAgentActivity({
      uid,
      action,
      params,
      status: 'failed',
      error: err.message,
      req
    });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
