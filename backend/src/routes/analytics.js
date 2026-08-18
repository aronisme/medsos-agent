const express = require('express');
const router = express.Router();
const { db, admin } = require('../config/firebase');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);

// Utility: Format Date string YYYY-MM-DD
const formatDateKey = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// GET /api/analytics/overview
// Comprehensive KPI & Aggregated Analytics for the Dashboard
router.get('/overview', async (req, res) => {
  try {
    const userId = req.user.id;
    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;

    // 1. Fetch all short links belonging to user (or system default)
    const linksSnap = await db.collection('short_links')
      .where('user_id', 'in', [userId, 'system'])
      .get();

    const links = linksSnap.docs.map(doc => ({
      id: doc.id,
      code: doc.id,
      short_url: `${baseUrl}/s/${doc.id}`,
      ...doc.data()
    }));

    let totalLinks = links.length;
    let totalClicks = 0;
    let totalHumanClicks = 0;
    let totalBotClicks = 0;

    let topProduct = null;
    let maxClicks = -1;

    links.forEach(link => {
      const clicks = Number(link.total_clicks) || 0;
      const human = Number(link.human_clicks) || clicks;
      const bot = Number(link.bot_clicks) || 0;

      totalClicks += clicks;
      totalHumanClicks += human;
      totalBotClicks += bot;

      if (clicks > maxClicks && link.title) {
        maxClicks = clicks;
        topProduct = {
          title: link.title,
          code: link.code,
          clicks: clicks,
          image_url: link.image_url || ''
        };
      }
    });

    // 2. Fetch click logs for user (in-memory date filter to avoid Firestore composite index requirements)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysIso = thirtyDaysAgo.toISOString();

    const clicksSnap = await db.collection('link_clicks')
      .where('user_id', 'in', [userId, 'system'])
      .get();

    const allClickDocs = clicksSnap.docs.map(doc => doc.data());
    const clickLogs = allClickDocs.filter(c => (c.timestamp || '') >= thirtyDaysIso);

    // Generate 30-day continuous map
    const trendMap = new Map();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = formatDateKey(d);
      trendMap.set(k, { date: k, clicks: 0, human: 0, bot: 0 });
    }

    const platformBreakdown = {
      Instagram: 0,
      Facebook: 0,
      Threads: 0,
      TikTok: 0,
      WhatsApp: 0,
      Telegram: 0,
      'Twitter / X': 0,
      'Direct / Link': 0,
      Lainnya: 0
    };

    const deviceBreakdown = {
      Mobile: 0,
      Desktop: 0,
      Tablet: 0,
      Bot: 0
    };

    const osBreakdown = {
      Android: 0,
      iOS: 0,
      Windows: 0,
      macOS: 0,
      Lainnya: 0
    };

    const todayKey = formatDateKey(new Date());
    let clicksToday = 0;

    clickLogs.forEach(c => {
      const logDate = c.date || (c.timestamp ? c.timestamp.split('T')[0] : null);
      if (logDate && trendMap.has(logDate)) {
        const item = trendMap.get(logDate);
        item.clicks++;
        if (c.is_bot) item.bot++;
        else item.human++;
      }

      if (logDate === todayKey) {
        clicksToday++;
      }

      // Platform distribution
      const p = c.platform || 'Direct / Link';
      if (platformBreakdown[p] !== undefined) {
        platformBreakdown[p]++;
      } else {
        platformBreakdown['Lainnya']++;
      }

      // Device
      const dev = c.device || 'Mobile';
      if (deviceBreakdown[dev] !== undefined) {
        deviceBreakdown[dev]++;
      } else {
        deviceBreakdown['Mobile']++;
      }

      // OS
      const os = c.os || 'Android';
      if (osBreakdown[os] !== undefined) {
        osBreakdown[os]++;
      } else {
        osBreakdown['Lainnya']++;
      }
    });

    // Determine Top Platform
    let topPlatform = 'Instagram';
    let topPlatformCount = -1;
    Object.entries(platformBreakdown).forEach(([plat, count]) => {
      if (count > topPlatformCount && plat !== 'Lainnya') {
        topPlatformCount = count;
        topPlatform = plat;
      }
    });

    const trend = Array.from(trendMap.values());

    res.json({
      success: true,
      summary: {
        total_links: totalLinks,
        total_clicks: totalClicks,
        human_clicks: totalHumanClicks,
        bot_clicks: totalBotClicks,
        clicks_today: clicksToday,
        top_platform: totalClicks > 0 ? topPlatform : 'Belum ada data',
        top_product: topProduct
      },
      trend: trend,
      platform_breakdown: platformBreakdown,
      device_breakdown: deviceBreakdown,
      os_breakdown: osBreakdown
    });

  } catch (err) {
    console.error('Error fetching analytics overview:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/links
// List all short links with performance metrics
router.get('/links', async (req, res) => {
  try {
    const userId = req.user.id;
    const { q, sortBy = 'clicks' } = req.query;
    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;

    const snap = await db.collection('short_links')
      .where('user_id', 'in', [userId, 'system'])
      .get();

    let links = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        code: doc.id,
        short_url: `${baseUrl}/s/${doc.id}`,
        title: d.title || 'Shopee Product',
        image_url: d.image_url || '',
        price: d.price || 0,
        product_url: d.product_url || '',
        destination_url: d.destination_url || '',
        total_clicks: Number(d.total_clicks) || 0,
        human_clicks: Number(d.human_clicks) || 0,
        bot_clicks: Number(d.bot_clicks) || 0,
        last_clicked_at: d.last_clicked_at || null,
        created_at: d.created_at || null
      };
    });

    // Search filter
    if (q && q.trim()) {
      const search = q.trim().toLowerCase();
      links = links.filter(l => 
        l.title.toLowerCase().includes(search) ||
        l.code.toLowerCase().includes(search) ||
        l.product_url.toLowerCase().includes(search)
      );
    }

    // Sort
    if (sortBy === 'clicks') {
      links.sort((a, b) => b.total_clicks - a.total_clicks);
    } else if (sortBy === 'newest') {
      links.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sortBy === 'oldest') {
      links.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    }

    res.json({
      success: true,
      count: links.length,
      links: links
    });

  } catch (err) {
    console.error('Error fetching analytics links:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/links/:code
// Single link deep-dive analytics
router.get('/links/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;

    const docSnap = await db.collection('short_links').doc(code).get();
    if (!docSnap.exists) {
      return res.status(404).json({ success: false, error: 'Link tidak ditemukan.' });
    }

    const linkData = {
      id: docSnap.id,
      code: docSnap.id,
      short_url: `${baseUrl}/s/${docSnap.id}`,
      ...docSnap.data()
    };

    // Fetch click logs for this specific link
    const clicksSnap = await db.collection('link_clicks')
      .where('code', '==', code)
      .get();

    const allClicks = clicksSnap.docs.map(doc => doc.data());
    allClicks.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    // Time series (last 14 days)
    const trendMap = new Map();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = formatDateKey(d);
      trendMap.set(k, { date: k, clicks: 0, human: 0, bot: 0 });
    }

    const platformBreakdown = {};
    const deviceBreakdown = { Mobile: 0, Desktop: 0, Tablet: 0, Bot: 0 };

    allClicks.forEach(c => {
      const logDate = c.date || (c.timestamp ? c.timestamp.split('T')[0] : null);
      if (logDate && trendMap.has(logDate)) {
        const item = trendMap.get(logDate);
        item.clicks++;
        if (c.is_bot) item.bot++;
        else item.human++;
      }

      const p = c.platform || 'Direct / Link';
      platformBreakdown[p] = (platformBreakdown[p] || 0) + 1;

      const dev = c.device || 'Mobile';
      if (deviceBreakdown[dev] !== undefined) deviceBreakdown[dev]++;
      else deviceBreakdown['Mobile']++;
    });

    res.json({
      success: true,
      link: linkData,
      trend: Array.from(trendMap.values()),
      platform_breakdown: platformBreakdown,
      device_breakdown: deviceBreakdown,
      recent_clicks: allClicks.slice(0, 30)
    });

  } catch (err) {
    console.error('Error fetching single link analytics:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/analytics/links/custom
// Create custom slug shortlink (e.g. /s/bella-square-promo)
router.post('/links/custom', async (req, res) => {
  try {
    const { custom_slug, product_url, title, image_url, price, tracking } = req.body || {};

    if (!custom_slug || !product_url) {
      return res.status(400).json({ success: false, error: 'custom_slug dan product_url wajib diisi.' });
    }

    const cleanSlug = String(custom_slug).trim().replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();
    if (cleanSlug.length < 3) {
      return res.status(400).json({ success: false, error: 'Custom slug minimal 3 karakter alfanumerik.' });
    }

    // Check if slug already exists
    const existingDoc = await db.collection('short_links').doc(cleanSlug).get();
    if (existingDoc.exists) {
      return res.status(409).json({ success: false, error: 'Slug kustom ini sudah digunakan. Silakan gunakan nama lain.' });
    }

    const affiliateId = process.env.SHOPEE_AFFILIATE_ID || '11328861338';
    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const now = new Date().toISOString();

    const shortUrl = `${baseUrl}/s/${cleanSlug}`;

    const linkDoc = {
      code: cleanSlug,
      user_id: req.user.id,
      title: title || 'Custom Promo Link',
      image_url: image_url || '',
      price: price || 0,
      product_url: product_url,
      destination_url: product_url, // or built affiliate link
      tracking: tracking || null,
      total_clicks: 0,
      human_clicks: 0,
      bot_clicks: 0,
      is_custom: true,
      created_at: now,
      updated_at: now
    };

    await db.collection('short_links').doc(cleanSlug).set(linkDoc);

    res.status(201).json({
      success: true,
      short_url: shortUrl,
      short_code: cleanSlug,
      link: linkDoc
    });

  } catch (err) {
    console.error('Error creating custom shortlink:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/analytics/links/:code
// Delete a shortlink
router.delete('/links/:code', async (req, res) => {
  try {
    const { code } = req.params;
    await db.collection('short_links').doc(code).delete();
    res.json({ success: true, message: `Shortlink /s/${code} berhasil dihapus.` });
  } catch (err) {
    console.error('Error deleting shortlink:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
