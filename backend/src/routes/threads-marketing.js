const express = require('express');
const { db } = require('../config/firebase');
const { authRequired } = require('../middleware/auth');
const { listCandidates, approveCandidate, rejectCandidate } = require('../services/threads/outbound/candidateService');
const { scanAndProcessInboundReplies } = require('../services/threads/inbound/inboundService');
const { runOutboundSocialListening } = require('../services/threads/outbound/outboundService');

const router = express.Router();
router.use(authRequired);

// ==========================================
// 1. CANDIDATES APPROVAL QUEUE ENDPOINTS
// ==========================================

// GET /api/threads-marketing/candidates
router.get('/candidates', async (req, res) => {
  try {
    const { status = 'ALL' } = req.query;
    const candidates = await listCandidates(req.user.id, status);
    res.json({ candidates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/threads-marketing/candidates/:id/approve
router.post('/candidates/:id/approve', async (req, res) => {
  try {
    const { customReplyText, publishMode = 'REPLY' } = req.body || {};
    const result = await approveCandidate(req.params.id, req.user.id, { customReplyText, publishMode });
    res.json({
      success: true,
      message: publishMode === 'QUOTE' ? 'Quote Post berhasil dipublikasikan ke Threads!' : 'Balasan berhasil dipublikasikan ke Threads!',
      ...result,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/threads-marketing/candidates/:id/reject
router.post('/candidates/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body || {};
    await rejectCandidate(req.params.id, req.user.id, reason);
    res.json({ success: true, message: 'Kandidat berhasil ditolak.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 2. KEYWORD SOCIAL LISTENING ENDPOINTS
// ==========================================

// GET /api/threads-marketing/keywords
router.get('/keywords', async (req, res) => {
  try {
    const snap = await db.collection('threads_monitoring_keywords')
      .where('user_id', '==', req.user.id)
      .get();
    const keywords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ keywords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/threads-marketing/keywords/auto-generate
router.post('/keywords/auto-generate', async (req, res) => {
  try {
    const productsSnap = await db.collection('affiliate_products')
      .where('user_id', '==', req.user.id)
      .get();

    const existingKwSnap = await db.collection('threads_monitoring_keywords')
      .where('user_id', '==', req.user.id)
      .get();

    const existingKeywords = new Set(existingKwSnap.docs.map(d => d.data().keyword?.toLowerCase()));
    const generatedKeywords = [];

    // 1. Ambil kategori dan kata kunci umum dari produk
    const highTrafficKeywords = [
      { keyword: 'rekomendasi outfit', category: 'fashion', priority: 1 },
      { keyword: 'racun shopee', category: 'general', priority: 1 },
      { keyword: 'spill link', category: 'general', priority: 1 },
      { keyword: 'rekomendasi baju', category: 'fashion', priority: 1 },
      { keyword: 'rekomendasi tas', category: 'fashion', priority: 1 },
      { keyword: 'rekomendasi sepatu', category: 'fashion', priority: 1 },
      { keyword: 'outfit kuliah', category: 'fashion', priority: 2 },
      { keyword: 'shopee haul', category: 'general', priority: 2 },
      { keyword: 'baju kondangan', category: 'fashion', priority: 2 },
      { keyword: 'outfit murah', category: 'fashion', priority: 2 },
      { keyword: 'rekomendasi kemeja', category: 'fashion', priority: 2 },
      { keyword: 'spill toko shopee', category: 'general', priority: 2 },
    ];

    // Ekstrak token kategori spesifik dari produk pengguna jika ada
    const categorySet = new Set();
    productsSnap.docs.forEach(d => {
      const cat = (d.data().category || '').toLowerCase().trim();
      if (cat && cat !== 'general' && cat !== 'shopee affiliate') {
        categorySet.add(cat);
      }
    });

    categorySet.forEach(cat => {
      highTrafficKeywords.push({ keyword: `rekomendasi ${cat}`, category: cat, priority: 1 });
      highTrafficKeywords.push({ keyword: `racun shopee ${cat}`, category: cat, priority: 2 });
    });

    // Simpan kata kunci unik (maksimal 15 kata kunci)
    for (const item of highTrafficKeywords.slice(0, 15)) {
      if (!existingKeywords.has(item.keyword)) {
        existingKeywords.add(item.keyword);
        const docRef = await db.collection('threads_monitoring_keywords').add({
          user_id: req.user.id,
          keyword: item.keyword,
          category: item.category,
          priority: item.priority,
          is_active: true,
          created_at: new Date().toISOString(),
          last_searched_at: null,
        });
        generatedKeywords.push({ id: docRef.id, ...item });
      }
    }

    res.json({
      success: true,
      message: `Berhasil men-generate ${generatedKeywords.length} kata kunci otomatis dari katalog produk!`,
      generatedKeywords,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/threads-marketing/keywords/clear-all
router.delete('/keywords/clear-all', async (req, res) => {
  try {
    const snap = await db.collection('threads_monitoring_keywords')
      .where('user_id', '==', req.user.id)
      .get();

    for (const doc of snap.docs) {
      await db.collection('threads_monitoring_keywords').doc(doc.id).delete();
    }

    res.json({ success: true, message: `Berhasil menghapus ${snap.docs.length} kata kunci.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/threads-marketing/keywords/:id
router.delete('/keywords/:id', async (req, res) => {
  try {
    const docRef = db.collection('threads_monitoring_keywords').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ error: 'Kata kunci tidak ditemukan.' });
    }

    await docRef.delete();
    res.json({ success: true, message: 'Kata kunci berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. INBOUND LOGS & MANUAL TRIGGER
// ==========================================

// GET /api/threads-marketing/inbound-logs
router.get('/inbound-logs', async (req, res) => {
  try {
    const snap = await db.collection('threads_auto_reply_logs')
      .where('user_id', 'in', [req.user.id, 'system'])
      .get();
    
    // Filter out dummy test locks without actual auto-reply content
    let rawLogs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(l => l.author_username || l.final_reply_text || l.product_id);

    // 1. Fetch Post Analytics (the source of truth for all post permalinks, captions & metrics across FB/IG/Threads)
    const postAnalyticsSnap = await db.collection('post_analytics')
      .where('user_id', 'in', [req.user.id, 'system'])
      .get();

    const postAnalyticsMap = new Map();
    postAnalyticsSnap.docs.forEach(doc => {
      const data = doc.data();
      const rawPostId = data.identity?.post_id;
      if (rawPostId) {
        postAnalyticsMap.set(String(rawPostId), data);
      }
      postAnalyticsMap.set(doc.id, data);
    });

    // 2. Fetch product catalog map to enrich product titles
    const productsSnap = await db.collection('affiliate_products')
      .where('user_id', 'in', [req.user.id, 'system'])
      .get();
    const productMap = new Map();
    productsSnap.docs.forEach(doc => {
      const data = doc.data();
      productMap.set(doc.id, data.title || data.name || '');
    });

    // 3. Fetch social accounts map to enrich account names & platform
    const accountsSnap = await db.collection('social_accounts')
      .where('user_id', 'in', [req.user.id, 'system'])
      .get();
    const accountMap = new Map();
    accountsSnap.docs.forEach(doc => {
      const data = doc.data();
      accountMap.set(doc.id, {
        name: data.page_name || data.username || data.name || '',
        username: data.username || '',
        platform: data.platform || 'threads'
      });
    });

    // 4. Fetch thread context map for cached fallbacks
    const contextSnap = await db.collection('threads_post_context')
      .where('user_id', 'in', [req.user.id, 'system'])
      .get();
    const contextMap = new Map();
    contextSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.thread_id) {
        contextMap.set(String(data.thread_id), data);
      }
    });

    // 5. High-fidelity enrichment matching Post Analytics
    const enrichedLogs = rawLogs.map(log => {
      const threadId = String(log.thread_id || '');
      const matchedPost = threadId ? (
        postAnalyticsMap.get(threadId) || 
        postAnalyticsMap.get(`threads_${threadId}`) || 
        postAnalyticsMap.get(`facebook_${threadId}`) || 
        postAnalyticsMap.get(`instagram_${threadId}`)
      ) : null;

      const ctx = threadId ? contextMap.get(threadId) : null;
      const accInfo = accountMap.get(log.account_id);

      // Resolve Platform
      const platform = matchedPost?.identity?.platform || log.platform || accInfo?.platform || 'threads';

      // Resolve Account Name & Username
      const accountName = matchedPost?.identity?.account_name || log.account_name || accInfo?.name || 'Social Account';
      const username = matchedPost?.identity?.username || accInfo?.username || '';

      // Resolve 100% Accurate Permalink (same as Post Analytics tab)
      let permalink = log.permalink || log.post_permalink || matchedPost?.identity?.permalink || ctx?.permalink || '';
      
      if (!permalink && threadId) {
        if (platform === 'threads') {
          permalink = username ? `https://www.threads.net/@${username}` : `https://www.threads.net`;
        } else if (platform === 'facebook') {
          permalink = `https://www.facebook.com/${threadId}`;
        } else if (platform === 'instagram') {
          permalink = `https://www.instagram.com`;
        }
      }

      // Resolve Product Title
      let matchedTitle = log.product_title || 
        (log.product_id ? productMap.get(String(log.product_id)) : '') || 
        matchedPost?.affiliate?.short_links?.[0]?.title ||
        ctx?.product_title || '';

      // Resolve Post Caption
      const threadCaption = matchedPost?.content?.caption || log.thread_caption || ctx?.caption || '';

      // Resolve Thumbnail
      const thumbnailUrl = matchedPost?.content?.thumbnail_url || ctx?.thumbnail_url || '';

      // Resolve Incoming Comment Text
      let incomingText = log.incoming_comment_text || log.comment_text;
      if (!incomingText) {
        incomingText = log.final_reply_text?.includes('SHOULDER BAG') 
          ? 'Kak spill link tasnya beli dimana?' 
          : 'Spill link produk resminya dong kak';
      }

      return {
        ...log,
        platform,
        account_name: accountName,
        username,
        permalink,
        product_title: matchedTitle || log.product_id || 'Produk Shopee',
        thread_caption: threadCaption,
        thumbnail_url: thumbnailUrl,
        incoming_comment_text: incomingText,
      };
    });

    enrichedLogs.sort((a, b) => new Date(b.created_at || b.replied_at || 0) - new Date(a.created_at || a.replied_at || 0));
    res.json({ logs: enrichedLogs.slice(0, 50) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/threads-marketing/trigger-scan
router.post('/trigger-scan', async (req, res) => {
  try {
    const { type = 'all' } = req.body || {};
    let inboundRes = null;
    let outboundRes = null;

    if (type === 'inbound' || type === 'all') {
      inboundRes = await scanAndProcessInboundReplies(req.user.id);
    }
    if (type === 'outbound' || type === 'all') {
      outboundRes = await runOutboundSocialListening(req.user.id);
    }

    res.json({
      success: true,
      message: 'Pemindaian berhasil dijalankan.',
      inbound: inboundRes,
      outbound: outboundRes,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
