const express = require('express');
const router = express.Router();
const { db, FieldValue } = require('../config/firebase');

// Utility: Classify Social Media / Traffic Source from Referer, User-Agent, and Bound Shortlink Platform
function classifyPlatform(referer = '', userAgent = '', boundPlatform = '') {
  const ref = String(referer || '').toLowerCase();
  const ua = String(userAgent || '').toLowerCase();
  const bound = String(boundPlatform || '').toLowerCase();

  // 1. Check Threads FIRST (Threads User-Agent contains 'barcelona' and sometimes 'instagram')
  if (
    ref.includes('threads.net') ||
    ref.includes('threads.com') ||
    ref.includes('l.threads.com') ||
    ref.includes('l.threads.net') ||
    ua.includes('barcelona') ||
    ua.includes('threads')
  ) {
    return 'Threads';
  }

  // 2. Check Facebook
  if (
    ref.includes('facebook.com') ||
    ref.includes('fb.com') ||
    ref.includes('fb.me') ||
    ref.includes('l.facebook.com') ||
    ref.includes('lm.facebook.com') ||
    ref.includes('m.facebook.com') ||
    ua.includes('fb_iab') ||
    ua.includes('fbav') ||
    ua.includes('facebook')
  ) {
    return 'Facebook';
  }

  // 3. Check Instagram (Pastikan bukan Barcelona/Threads)
  if (
    (ref.includes('instagram.com') || ref.includes('l.instagram.com') || ua.includes('instagram')) &&
    !ua.includes('barcelona') &&
    !ua.includes('threads')
  ) {
    return 'Instagram';
  }

  // 4. Other Social Platforms
  if (ref.includes('tiktok.com') || ua.includes('tiktok') || ua.includes('bytedance')) return 'TikTok';
  if (ref.includes('whatsapp') || ref.includes('wa.me') || ua.includes('whatsapp')) return 'WhatsApp';
  if (ref.includes('telegram') || ref.includes('t.me') || ua.includes('telegram')) return 'Telegram';
  if (ref.includes('twitter.com') || ref.includes('x.com') || ref.includes('t.co') || ua.includes('twitter')) return 'Twitter / X';
  if (ref.includes('youtube.com') || ref.includes('youtu.be')) return 'YouTube';
  if (ref.includes('pinterest.com')) return 'Pinterest';
  if (ref.includes('google.com')) return 'Google Search';

  // 5. Fallback ke Bound Platform jika direct / referer kosong (karena browser mobile sering strip referrer)
  if (!referer || referer === '-' || ref === 'direct' || ref === '') {
    if (bound === 'threads') return 'Threads';
    if (bound === 'facebook') return 'Facebook';
    if (bound === 'instagram') return 'Instagram';
    if (bound === 'tiktok') return 'TikTok';
    return 'Direct / Link';
  }

  try {
    const url = new URL(referer);
    const host = url.hostname.replace(/^www\./, '');
    if (host.includes('threads')) return 'Threads';
    if (host.includes('facebook') || host.includes('fb.')) return 'Facebook';
    if (host.includes('instagram')) return 'Instagram';
    return host;
  } catch {
    if (bound === 'threads') return 'Threads';
    if (bound === 'facebook') return 'Facebook';
    if (bound === 'instagram') return 'Instagram';
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


// Utility: Check if request is browser pre-render / pre-fetch
function isPrefetchRequest(req) {
  const secPurpose = String(req.headers['sec-purpose'] || '').toLowerCase();
  const purpose = String(req.headers['purpose'] || '').toLowerCase();
  const xPurpose = String(req.headers['x-purpose'] || '').toLowerCase();
  const xMoz = String(req.headers['x-moz'] || '').toLowerCase();
  return (
    secPurpose.includes('prefetch') ||
    purpose.includes('prefetch') ||
    xPurpose.includes('preview') ||
    xMoz.includes('prefetch')
  );
}

// GET /s/:code
// Fast Redirect with Persistent Cooldown & Asynchronous Non-Blocking Analytics Logging
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
    let destination = data.destination_url || data.product_url || data.target_url || data.url || data.link;

    if (!destination && data.product_id) {
      try {
        const prodSnap = await db.collection('affiliate_products').doc(data.product_id).get();
        if (prodSnap.exists) {
          const p = prodSnap.data();
          destination = p.product_url || p.affiliate_link || p.link;
        }
      } catch (_) {}
    }

    if (!destination) {
      return res.status(404).send('<!DOCTYPE html><html><head><title>Link Tidak Valid</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;"><h2>Link tujuan tidak valid atau produk sudah tidak tersedia.</h2></body></html>');
    }

    if (!destination.startsWith('http://') && !destination.startsWith('https://')) {
      destination = `https://${destination}`;
    }

    const userAgent = req.get('User-Agent') || '';
    const referer = req.get('Referer') || req.get('Referrer') || '';
    const isBot = detectBot(userAgent);
    const platform = classifyPlatform(referer, userAgent, data.platform);

    // Persistent serverless cooldown check (12 seconds window per shortlink)
    // Eliminates Facebook Link-Shim proxy pre-checks, pre-rendering, and double-taps
    const nowEpoch = Date.now();
    const lastClickEpoch = Number(data.last_click_epoch) || 0;
    const timeSinceLastClick = nowEpoch - lastClickEpoch;
    const isPrefetch = isPrefetchRequest(req);
    const isRapidDuplicate = Boolean(lastClickEpoch > 0 && timeSinceLastClick < 12000);

    // 2. Perform Instant HTTP 302 Redirect (Zero Latency)
    res.redirect(302, destination);

    // 3. Process Analytics Asynchronously in Background
    setImmediate(async () => {
      try {
        const { device, os, browser } = parseDeviceAndOS(userAgent);

        // Geolocation headers (Vercel / Cloudflare / Standard)
        const country = req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || 'ID';
        const city = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : 'Indonesia';
        
        const now = new Date();
        const nowIso = now.toISOString();
        const dateKey = nowIso.split('T')[0]; // YYYY-MM-DD
        const hour = now.getHours();

        // If request is browser pre-render or duplicate Link-Shim within 12s, only refresh epoch timestamp
        if (isPrefetch || isRapidDuplicate) {
          await docRef.update({
            last_click_epoch: nowEpoch,
            updated_at: nowIso
          });
          return;
        }

        // Increment stats on the short link document atomically
        const updatePayload = {
          total_clicks: FieldValue.increment(1),
          last_click_epoch: nowEpoch,
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
          post_id: data.post_id || data.tracking?.post_id || '',
          account_id: data.account_id || data.tracking?.account_id || '',
          account_name: data.account_name || data.tracking?.account_name || '',
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

        // Real-time Closed-Loop Attribution to Agent Memory & Product Lifecycle
        if (!isBot && code) {
          try {
            const memSnap = await db.collection('product_post_memory')
              .where('context_at_post.shortlink_code', '==', code)
              .get();

            if (!memSnap.empty) {
              const currentQuarter = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
              for (const memDoc of memSnap.docs) {
                const memData = memDoc.data();
                await memDoc.ref.update({
                  'raw_metrics.affiliate_clicks': FieldValue.increment(1),
                  last_synced_at: nowIso
                });

                if (memData.product_id) {
                  const { updateProductQuarterlySnapshot } = require('../services/agent/productPostMemoryService');
                  await updateProductQuarterlySnapshot(memData.product_id, currentQuarter, memData.user_id || data.user_id || 'system');
                }
              }
            } else if (data.product_id) {
              const currentQuarter = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
              const { updateProductQuarterlySnapshot } = require('../services/agent/productPostMemoryService');
              await updateProductQuarterlySnapshot(data.product_id, currentQuarter, data.user_id || 'system');
            }
          } catch (memErr) {
            console.warn('[Realtime Memory Click Sync Warning]:', memErr.message);
          }
        }

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
