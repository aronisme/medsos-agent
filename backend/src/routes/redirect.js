const express = require('express');
const router = express.Router();
const { db, FieldValue } = require('../config/firebase');

// Utility: Classify Social Media / Traffic Source from Referer and User-Agent
function classifyPlatform(referer = '', userAgent = '') {
  const ref = String(referer).toLowerCase();
  const ua = String(userAgent).toLowerCase();

  if (ref.includes('instagram.com') || ua.includes('instagram')) return 'Instagram';
  if (ref.includes('facebook.com') || ref.includes('fb.com') || ref.includes('fb.me') || ua.includes('fb_iab') || ua.includes('fbav') || ua.includes('facebook')) return 'Facebook';
  if (ref.includes('threads.net') || ua.includes('barcelona') || ua.includes('threads')) return 'Threads';
  if (ref.includes('tiktok.com') || ua.includes('tiktok') || ua.includes('bytedance')) return 'TikTok';
  if (ref.includes('whatsapp') || ref.includes('wa.me') || ua.includes('whatsapp')) return 'WhatsApp';
  if (ref.includes('telegram') || ref.includes('t.me') || ua.includes('telegram')) return 'Telegram';
  if (ref.includes('twitter.com') || ref.includes('x.com') || ref.includes('t.co') || ua.includes('twitter')) return 'Twitter / X';
  if (ref.includes('youtube.com') || ref.includes('youtu.be')) return 'YouTube';
  if (ref.includes('pinterest.com')) return 'Pinterest';
  if (ref.includes('google.com')) return 'Google Search';

  if (!referer || referer === '-' || ref === 'direct') return 'Direct / Link';
  
  try {
    const url = new URL(referer);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return 'Lainnya';
  }
}

// Utility: Detect Bots & Crawler Previews
function detectBot(userAgent = '') {
  const ua = String(userAgent).toLowerCase();
  const botPatterns = [
    'bot', 'spider', 'crawler', 'preview', 'facebookexternalhit', 'facebot',
    'whatsapp', 'telegrambot', 'twitterbot', 'slackbot', 'discordbot',
    'googlebot', 'bingbot', 'yandexbot', 'duckduckbot', 'baiduspider',
    'applebot', 'semrushbot', 'ahrefsbot', 'mj12bot', 'bytespider'
  ];
  return botPatterns.some(p => ua.includes(p));
}

// Utility: Parse Device & OS
function parseDeviceAndOS(userAgent = '') {
  const ua = String(userAgent);
  let device = 'Desktop';
  let os = 'Unknown OS';
  let browser = 'Browser';

  // Device & OS
  if (/iPad/i.test(ua)) {
    device = 'Tablet';
    os = 'iPadOS';
  } else if (/iPhone/i.test(ua)) {
    device = 'Mobile';
    os = 'iOS';
  } else if (/Android/i.test(ua)) {
    device = 'Mobile';
    os = 'Android';
  } else if (/Windows NT/i.test(ua)) {
    device = 'Desktop';
    os = 'Windows';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    device = 'Desktop';
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    device = 'Desktop';
    os = 'Linux';
  }

  // In-App Browser vs Standard Browser
  if (/Instagram/i.test(ua)) {
    browser = 'Instagram App';
  } else if (/FB_IAB|FBAV/i.test(ua)) {
    browser = 'Facebook App';
  } else if (/WhatsApp/i.test(ua)) {
    browser = 'WhatsApp';
  } else if (/Chrome|CriOS/i.test(ua)) {
    browser = 'Chrome';
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari';
  } else if (/Firefox|FxiOS/i.test(ua)) {
    browser = 'Firefox';
  } else if (/Edg/i.test(ua)) {
    browser = 'Edge';
  }

  return { device, os, browser };
}

// GET /s/:code
// Fast Redirect with Asynchronous Non-Blocking Analytics Logging
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    // 1. Fetch link metadata from Firestore
    const docRef = db.collection('short_links').doc(code);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).send('<!DOCTYPE html><html><head><title>Link Tidak Ditemukan</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>Link tidak ditemukan atau telah kedaluwarsa.</h2></body></html>');
    }

    const data = docSnap.data() || {};
    const destination = data.destination_url || data.product_url;

    if (!destination) {
      return res.status(404).send('Link tujuan tidak valid.');
    }

    // 2. Perform Instant HTTP 302 Redirect (Zero Latency)
    res.redirect(302, destination);

    // 3. Process Analytics Asynchronously in Background (Fire and Forget)
    setImmediate(async () => {
      try {
        const userAgent = req.get('User-Agent') || '';
        const referer = req.get('Referer') || req.get('Referrer') || '';
        const isBot = detectBot(userAgent);
        const platform = classifyPlatform(referer, userAgent);
        const { device, os, browser } = parseDeviceAndOS(userAgent);

        // Geolocation headers (Vercel / Cloudflare / Standard)
        const country = req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || 'ID';
        const city = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : 'Indonesia';
        
        const now = new Date();
        const nowIso = now.toISOString();
        const dateKey = nowIso.split('T')[0]; // YYYY-MM-DD
        const hour = now.getHours();

        // Increment stats on the short link document atomically
        const updatePayload = {
          total_clicks: FieldValue.increment(1),
          last_clicked_at: nowIso,
          updated_at: nowIso
        };

        if (isBot) {
          updatePayload.bot_clicks = FieldValue.increment(1);
        } else {
          updatePayload.human_clicks = FieldValue.increment(1);
        }

        // Sub-ID tracking tag if any
        const subId = data.tracking?.sub_publisher_id || data.tracking?.source || '';

        // Save detailed click log
        const clickDocRef = db.collection('link_clicks').doc();
        const clickLog = {
          id: clickDocRef.id,
          code: code,
          user_id: data.user_id || 'system',
          product_id: data.product_id || '',
          product_title: data.title || data.product_title || 'Shopee Product',
          product_url: data.product_url || '',
          destination_url: destination,
          platform: platform,
          referrer: referer.slice(0, 255),
          device: isBot ? 'Bot' : device,
          os: isBot ? 'Crawler' : os,
          browser: browser,
          country: country,
          city: city,
          is_bot: isBot,
          sub_id: subId,
          timestamp: nowIso,
          date: dateKey,
          hour: hour
        };

        await Promise.all([
          docRef.update(updatePayload),
          clickDocRef.set(clickLog)
        ]);

      } catch (logErr) {
        console.error('[Async Analytics Error]:', logErr.message);
      }
    });

  } catch (error) {
    console.error('Error in redirect route:', error);
    res.status(500).send('Internal server error.');
  }
});

module.exports = router;
