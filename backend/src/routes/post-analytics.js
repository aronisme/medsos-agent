const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { authRequired } = require('../middleware/auth');
const { syncAllPostsAnalytics, getPlatformConnectionStatus } = require('../services/postAnalytics/syncService');
const { getPostHistory } = require('../services/postAnalytics/snapshotService');

router.use(authRequired);

/**
 * GET /api/analytics/posts
 * Mengambil daftar postingan ternormalisasi dengan filter dan sorting
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { platform = 'all', account_id, q, sortBy = 'newest', limit = 50 } = req.query;

    let query = db.collection('post_analytics').where('user_id', 'in', [userId, 'system']);

    if (platform && platform !== 'all') {
      query = query.where('identity.platform', '==', platform.toLowerCase());
    }

    const snap = await query.get();
    let posts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Account ID Filter (in-memory)
    if (account_id) {
      posts = posts.filter(p => p.identity?.account_id === account_id);
    }

    // Search query
    if (q && q.trim()) {
      const search = q.trim().toLowerCase();
      posts = posts.filter(p =>
        (p.content?.caption || '').toLowerCase().includes(search) ||
        (p.identity?.account_name || '').toLowerCase().includes(search) ||
        (p.identity?.post_id || '').toLowerCase().includes(search)
      );
    }

    // Sorting
    posts.sort((a, b) => {
      if (sortBy === 'views') {
        return (b.metrics?.views || 0) - (a.metrics?.views || 0);
      } else if (sortBy === 'likes') {
        return (b.metrics?.likes || 0) - (a.metrics?.likes || 0);
      } else if (sortBy === 'comments') {
        return (b.metrics?.comments || 0) - (a.metrics?.comments || 0);
      } else if (sortBy === 'shares') {
        return (b.metrics?.shares || 0) - (a.metrics?.shares || 0);
      } else if (sortBy === 'clicks') {
        return (b.affiliate?.human_clicks || b.affiliate?.total_clicks || 0) -
               (a.affiliate?.human_clicks || a.affiliate?.total_clicks || 0);
      } else if (sortBy === 'oldest') {
        return new Date(a.content?.published_at || 0) - new Date(b.content?.published_at || 0);
      } else {
        // default: newest
        return new Date(b.content?.published_at || 0) - new Date(a.content?.published_at || 0);
      }
    });

    const parsedLimit = parseInt(limit, 10) || 50;
    const paginatedPosts = posts.slice(0, parsedLimit);

    // Fetch user's sync metadata
    const metaDoc = await db.collection('analytics_meta').doc(userId).get();
    const metaData = metaDoc.exists ? metaDoc.data() : null;

    res.json({
      success: true,
      count: posts.length,
      total_unfiltered: posts.length,
      last_synced_at: metaData?.last_synced_at || null,
      posts: paginatedPosts,
    });
  } catch (err) {
    console.error('Error fetching posts analytics:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/analytics/posts/summary
 * Mengambil ringkasan akumulasi metrik mentah
 */
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.id;
    const snap = await db.collection('post_analytics')
      .where('user_id', 'in', [userId, 'system'])
      .get();

    const posts = snap.docs.map(doc => doc.data());

    const globalSummary = {
      total_posts: posts.length,
      total_views: 0,
      total_reach: 0,
      total_likes: 0,
      total_comments: 0,
      total_shares: 0,
      total_saves: 0,
      total_affiliate_clicks: 0,
    };

    const platformBreakdown = {
      facebook: { posts: 0, likes: 0, comments: 0, shares: 0, affiliate_clicks: 0 },
      instagram: { posts: 0, views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0, affiliate_clicks: 0 },
      threads: { posts: 0, views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0, affiliate_clicks: 0 },
    };

    posts.forEach((p) => {
      const plat = p.identity?.platform;
      const m = p.metrics || {};
      const affClicks = p.affiliate?.human_clicks || p.affiliate?.total_clicks || 0;

      // Global rollups
      if (m.views != null) globalSummary.total_views += m.views;
      if (m.reach != null) globalSummary.total_reach += m.reach;
      globalSummary.total_likes += m.likes || 0;
      globalSummary.total_comments += (m.comments || 0) + (m.replies || 0);
      globalSummary.total_shares += (m.shares || 0) + (m.reposts || 0) + (m.quotes || 0);
      if (m.saves != null) globalSummary.total_saves += m.saves;
      globalSummary.total_affiliate_clicks += affClicks;

      // Platform specific rollups
      if (plat === 'facebook') {
        platformBreakdown.facebook.posts++;
        platformBreakdown.facebook.likes += m.likes || 0;
        platformBreakdown.facebook.comments += m.comments || 0;
        platformBreakdown.facebook.shares += m.shares || 0;
        platformBreakdown.facebook.affiliate_clicks += affClicks;
      } else if (plat === 'instagram') {
        platformBreakdown.instagram.posts++;
        if (m.views != null) platformBreakdown.instagram.views += m.views;
        if (m.reach != null) platformBreakdown.instagram.reach += m.reach;
        platformBreakdown.instagram.likes += m.likes || 0;
        platformBreakdown.instagram.comments += m.comments || 0;
        platformBreakdown.instagram.shares += m.shares || 0;
        if (m.saves != null) platformBreakdown.instagram.saves += m.saves;
        platformBreakdown.instagram.affiliate_clicks += affClicks;
      } else if (plat === 'threads') {
        platformBreakdown.threads.posts++;
        if (m.views != null) platformBreakdown.threads.views += m.views;
        platformBreakdown.threads.likes += m.likes || 0;
        platformBreakdown.threads.replies += m.replies || 0;
        platformBreakdown.threads.reposts += m.reposts || 0;
        platformBreakdown.threads.quotes += m.quotes || 0;
        platformBreakdown.threads.affiliate_clicks += affClicks;
      }
    });

    res.json({
      success: true,
      global: globalSummary,
      platforms: platformBreakdown,
    });
  } catch (err) {
    console.error('Error fetching analytics summary:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/analytics/posts/status
 * Status koneksi API per platform
 */
router.get('/status', async (req, res) => {
  try {
    const status = await getPlatformConnectionStatus(req.user.id);
    res.json({ success: true, platforms: status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/analytics/posts/sync
 * Memicu sinkronisasi on-demand dari Meta API
 */
router.post('/sync', async (req, res) => {
  try {
    const result = await syncAllPostsAnalytics(req.user.id, { limit: 30 });
    res.json(result);
  } catch (err) {
    console.error('Error in post analytics sync:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/analytics/posts/:id/history
 * Mengambil time-series snapshot history untuk postingan tertentu
 */
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const history = await getPostHistory(id, 50);
    res.json({
      success: true,
      post_id: id,
      count: history.length,
      history,
    });
  } catch (err) {
    console.error('Error fetching post history:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/analytics/posts/:id
 * Mengambil detail 1 postingan
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await db.collection('post_analytics').doc(id).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'Postingan analitik tidak ditemukan.' });
    }

    res.json({
      success: true,
      post: { id: doc.id, ...doc.data() },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
