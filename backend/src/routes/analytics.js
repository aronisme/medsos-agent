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

// Helper to normalize platform name
function normalizePlatformName(p) {
  if (!p) return 'Direct / Link';
  const clean = String(p).trim().toLowerCase();
  if (clean === 'facebook' || clean === 'fb' || clean.includes('facebook') || clean.includes('fb.')) return 'Facebook';
  if (clean === 'threads' || clean.includes('threads') || clean === 'barcelona') return 'Threads';
  if (clean === 'instagram' || clean === 'ig' || clean.includes('instagram')) return 'Instagram';
  if (clean === 'tiktok' || clean.includes('tiktok')) return 'TikTok';
  if (clean === 'whatsapp' || clean.includes('whatsapp') || clean === 'wa.me') return 'WhatsApp';
  if (clean === 'telegram' || clean.includes('telegram') || clean === 't.me') return 'Telegram';
  if (clean === 'twitter' || clean === 'x' || clean === 'twitter / x' || clean.includes('twitter') || clean === 't.co') return 'Twitter / X';
  if (clean === 'youtube' || clean.includes('youtube') || clean === 'youtu.be') return 'YouTube';
  if (clean === 'pinterest' || clean.includes('pinterest')) return 'Pinterest';
  if (clean === 'google search' || clean === 'google' || clean.includes('google')) return 'Google Search';
  if (clean === 'direct' || clean === 'direct / link' || clean === '-') return 'Direct / Link';
  return p;
}

// GET /api/analytics/overview
// Comprehensive KPI & Aggregated Analytics with Dynamic Range (today, 7d, 30d, all)
router.get('/overview', async (req, res) => {
  try {
    const userId = req.user.id;
    const { range = '30d' } = req.query;
    const baseUrl = (process.env.PUBLIC_URL || process.env.BASE_URL || 'https://shopee-link-aff.vercel.app').replace(/medsos-agent\.vercel\.app/g, 'shopee-link-aff.vercel.app');

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
    let totalClicksAllTime = 0;
    let totalHumanClicksAllTime = 0;
    let totalBotClicksAllTime = 0;

    let topProduct = null;
    let maxClicks = -1;

    links.forEach(link => {
      const clicks = Number(link.total_clicks) || 0;
      const human = Number(link.human_clicks) || clicks;
      const bot = Number(link.bot_clicks) || 0;

      totalClicksAllTime += clicks;
      totalHumanClicksAllTime += human;
      totalBotClicksAllTime += bot;

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

    // 2. Fetch all click logs for user
    const clicksSnap = await db.collection('link_clicks')
      .where('user_id', 'in', [userId, 'system'])
      .get();

    const allClickDocs = clicksSnap.docs.map(doc => doc.data());
    const now = new Date();
    const todayKey = formatDateKey(now);

    // Filter click logs according to selected range
    let filteredClickLogs = [];
    let trendMap = new Map();
    let isHourly = false;

    if (range === 'today') {
      isHourly = true;
      filteredClickLogs = allClickDocs.filter(c => {
        const logDate = c.date || (c.timestamp ? c.timestamp.split('T')[0] : null);
        return logDate === todayKey;
      });

      // 24 Hourly Slots (00:00 - 23:00)
      for (let h = 0; h < 24; h++) {
        const label = `${String(h).padStart(2, '0')}:00`;
        trendMap.set(h, { date: label, hour: h, clicks: 0, human: 0, bot: 0 });
      }
    } else if (range === '7d') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      const sevenDaysIso = sevenDaysAgo.toISOString();

      filteredClickLogs = allClickDocs.filter(c => (c.timestamp || '') >= sevenDaysIso);

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const k = formatDateKey(d);
        trendMap.set(k, { date: k, clicks: 0, human: 0, bot: 0 });
      }
    } else if (range === 'all') {
      filteredClickLogs = allClickDocs;

      // Group all historical dates
      const uniqueDates = Array.from(new Set(allClickDocs.map(c => c.date || (c.timestamp ? c.timestamp.split('T')[0] : null)).filter(Boolean))).sort();
      if (uniqueDates.length === 0) {
        uniqueDates.push(todayKey);
      }
      uniqueDates.forEach(k => {
        trendMap.set(k, { date: k, clicks: 0, human: 0, bot: 0 });
      });
    } else {
      // Default: '30d'
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      const thirtyDaysIso = thirtyDaysAgo.toISOString();

      filteredClickLogs = allClickDocs.filter(c => (c.timestamp || '') >= thirtyDaysIso);

      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const k = formatDateKey(d);
        trendMap.set(k, { date: k, clicks: 0, human: 0, bot: 0 });
      }
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

    const accountBreakdown = {};

    let periodTotalClicks = 0;
    let periodHumanClicks = 0;
    let periodBotClicks = 0;
    let clicksToday = 0;

    filteredClickLogs.forEach(c => {
      periodTotalClicks++;
      if (c.is_bot) periodBotClicks++;
      else periodHumanClicks++;

      const logDate = c.date || (c.timestamp ? c.timestamp.split('T')[0] : null);
      if (logDate === todayKey) {
        clicksToday++;
      }

      // Populate trend map
      if (isHourly) {
        const h = typeof c.hour === 'number' ? c.hour : (c.timestamp ? new Date(c.timestamp).getHours() : 0);
        if (trendMap.has(h)) {
          const item = trendMap.get(h);
          item.clicks++;
          if (c.is_bot) item.bot++;
          else item.human++;
        }
      } else {
        if (logDate && trendMap.has(logDate)) {
          const item = trendMap.get(logDate);
          item.clicks++;
          if (c.is_bot) item.bot++;
          else item.human++;
        }
      }

      // Platform distribution (Normalized)
      const rawPlatform = c.platform || 'Direct / Link';
      const normalizedPlat = normalizePlatformName(rawPlatform);
      if (platformBreakdown[normalizedPlat] !== undefined) {
        platformBreakdown[normalizedPlat]++;
      } else {
        platformBreakdown['Lainnya']++;
      }

      // Account breakdown
      const accName = c.account_name || 'Akun Utama';
      if (accName) {
        accountBreakdown[accName] = (accountBreakdown[accName] || 0) + 1;
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

    // Determine Top Platform in Period
    let topPlatform = 'Facebook';
    let topPlatformCount = -1;
    Object.entries(platformBreakdown).forEach(([plat, count]) => {
      if (count > topPlatformCount && plat !== 'Lainnya' && plat !== 'Direct / Link') {
        topPlatformCount = count;
        topPlatform = plat;
      }
    });

    const trend = Array.from(trendMap.values());

    res.json({
      success: true,
      range: range,
      summary: {
        total_links: totalLinks,
        total_clicks: periodTotalClicks,
        human_clicks: periodHumanClicks,
        bot_clicks: periodBotClicks,
        all_time_clicks: totalClicksAllTime,
        clicks_today: clicksToday,
        top_platform: periodTotalClicks > 0 ? topPlatform : 'Belum ada data',
        top_product: topProduct
      },
      trend: trend,
      platform_breakdown: platformBreakdown,
      account_breakdown: accountBreakdown,
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
    const baseUrl = (process.env.PUBLIC_URL || process.env.BASE_URL || 'https://shopee-link-aff.vercel.app').replace(/medsos-agent\.vercel\.app/g, 'shopee-link-aff.vercel.app');

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
    const baseUrl = (process.env.PUBLIC_URL || process.env.BASE_URL || 'https://shopee-link-aff.vercel.app').replace(/medsos-agent\.vercel\.app/g, 'shopee-link-aff.vercel.app');

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
    const baseUrl = (process.env.PUBLIC_URL || process.env.BASE_URL || 'https://shopee-link-aff.vercel.app').replace(/medsos-agent\.vercel\.app/g, 'shopee-link-aff.vercel.app');
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
