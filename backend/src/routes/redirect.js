const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { db, FieldValue } = require('../config/firebase');

// 1. Known Crawlers & Meta Bots Patterns
const KNOWN_CRAWLERS = [
  'facebookexternalhit', 'meta-externalagent', 'meta-externalfetcher', 'facebookcatalog',
  'facebot', 'facebookbot', 'meta-webindexer', 'googlebot', 'bingbot', 'yandexbot',
  'duckduckbot', 'baiduspider', 'applebot', 'semrushbot', 'ahrefsbot', 'mj12bot',
  'bytespider', 'twitterbot', 'telegrambot', 'whatsapp', 'slackbot', 'discordbot',
  'linkedinbot', 'pinterestbot', 'tumblr'
];

// 2. Automated Script / CLI Tools
const AUTOMATED_TOOLS = [
  'curl/', 'python-requests', 'python/', 'aiohttp', 'go-http-client', 'axios/',
  'node-fetch', 'undici', 'okhttp/', 'dalvik/', 'postmanruntime', 'insomnia',
  'wget/', 'httpie', 'scrapy', 'headlesschrome', 'phantomjs', 'puppeteer', 'playwright'
];

function isMetaOrSearchCrawler(ua = '') {
  const cleanUa = String(ua).toLowerCase();
  return KNOWN_CRAWLERS.some(c => cleanUa.includes(c));
}

function isAutomationTool(ua = '') {
  const cleanUa = String(ua).toLowerCase();
  return AUTOMATED_TOOLS.some(t => cleanUa.includes(t));
}

function isExplicitPrefetch(req) {
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

function isStandardOrInAppBrowser(ua = '') {
  const cleanUa = String(ua).toLowerCase();
  const browserTokens = ['mozilla', 'chrome', 'safari', 'firefox', 'edge', 'edg', 'fb_iab', 'fbav', 'barcelona', 'instagram'];
  return browserTokens.some(b => cleanUa.includes(b)) && !isAutomationTool(ua) && !isMetaOrSearchCrawler(ua);
}

// Decoupled Source Attribution: derives verified actual source and evidence without guessing
function detectActualTrafficSource(referer = '', userAgent = '') {
  const ref = String(referer || '').toLowerCase();
  const ua = String(userAgent || '').toLowerCase();
  const evidence = [];

  // Threads
  if (ref.includes('threads.net') || ref.includes('threads.com') || ref.includes('l.threads.com') || ref.includes('l.threads.net') || ua.includes('barcelona')) {
    if (ref.includes('threads')) evidence.push(`referer:${ref.slice(0, 40)}`);
    if (ua.includes('barcelona')) evidence.push('ua:barcelona');
    return { actual_source: 'Threads', source_confidence: 0.95, source_evidence: evidence };
  }

  // Facebook
  if (ref.includes('facebook.com') || ref.includes('fb.com') || ref.includes('fb.me') || ref.includes('l.facebook.com') || ref.includes('lm.facebook.com') || ua.includes('fb_iab') || ua.includes('fbav')) {
    if (ref.includes('facebook') || ref.includes('fb.')) evidence.push(`referer:${ref.slice(0, 40)}`);
    if (ua.includes('fb_iab') || ua.includes('fbav')) evidence.push('ua:fb_iab');
    return { actual_source: 'Facebook', source_confidence: 0.95, source_evidence: evidence };
  }

  // Instagram
  if (ref.includes('instagram.com') || ref.includes('l.instagram.com') || (ua.includes('instagram') && !ua.includes('barcelona'))) {
    if (ref.includes('instagram')) evidence.push(`referer:${ref.slice(0, 40)}`);
    if (ua.includes('instagram')) evidence.push('ua:instagram');
    return { actual_source: 'Instagram', source_confidence: 0.95, source_evidence: evidence };
  }

  // WhatsApp
  if (ref.includes('whatsapp') || ref.includes('wa.me') || ua.includes('whatsapp')) {
    evidence.push('evidence:whatsapp');
    return { actual_source: 'WhatsApp', source_confidence: 0.90, source_evidence: evidence };
  }

  // TikTok
  if (ref.includes('tiktok.com') || ua.includes('tiktok') || ua.includes('bytedance')) {
    evidence.push('evidence:tiktok');
    return { actual_source: 'TikTok', source_confidence: 0.90, source_evidence: evidence };
  }

  // Telegram
  if (ref.includes('telegram') || ref.includes('t.me') || ua.includes('telegram')) {
    evidence.push('evidence:telegram');
    return { actual_source: 'Telegram', source_confidence: 0.90, source_evidence: evidence };
  }

  // Twitter / X
  if (ref.includes('twitter.com') || ref.includes('x.com') || ref.includes('t.co') || ua.includes('twitter')) {
    evidence.push('evidence:twitter');
    return { actual_source: 'Twitter / X', source_confidence: 0.90, source_evidence: evidence };
  }

  // Google Search
  if (ref.includes('google.com') || ref.includes('google.co.id')) {
    evidence.push('evidence:google_search');
    return { actual_source: 'Google Search', source_confidence: 0.85, source_evidence: evidence };
  }

  // Other specific domain referrers
  if (referer && referer !== '-' && !ref.includes('direct')) {
    try {
      const parsedHost = new URL(referer).hostname.replace(/^www\./, '');
      return { actual_source: parsedHost, source_confidence: 0.70, source_evidence: [`referer_host:${parsedHost}`] };
    } catch (_) {}
  }

  // Direct / No Referrer
  return { actual_source: 'Direct / External', source_confidence: 0.20, source_evidence: ['no_referer'] };
}

// Request Analyzer & Risk Scoring Engine
function analyzeRequest(req) {
  const ua = req.get('User-Agent') || '';
  const referer = req.get('Referer') || req.get('Referrer') || '';
  const secFetchUser = req.headers['sec-fetch-user'];
  const secFetchMode = req.headers['sec-fetch-mode'];
  const secFetchDest = req.headers['sec-fetch-dest'];

  const isCrawler = isMetaOrSearchCrawler(ua);
  const isPrefetch = isExplicitPrefetch(req);
  const isCliTool = isAutomationTool(ua);
  const isBrowser = isStandardOrInAppBrowser(ua);

  let riskScore = 0;
  const signals = [];

  // Negative / Human signals
  if (secFetchUser === '?1') {
    riskScore -= 50;
    signals.push('user_activation_gesture');
  }
  if (secFetchMode === 'navigate' && secFetchDest === 'document') {
    riskScore -= 40;
    signals.push('top_level_document_nav');
  }
  if (isBrowser) {
    riskScore -= 20;
    signals.push('browser_signature');
  }

  // Positive / Bot / Prefetch risk signals
  if (isCrawler) {
    riskScore += 100;
    signals.push('crawler_signature');
  }
  if (isPrefetch) {
    riskScore += 90;
    signals.push('explicit_prefetch_header');
  }
  if (isCliTool) {
    riskScore += 70;
    signals.push('cli_automation_ua');
  }
  if (secFetchDest && secFetchDest !== 'document') {
    riskScore += 30;
    signals.push('non_document_fetch');
  }
  if (!referer || referer === '-') {
    riskScore += 10;
    signals.push('no_referer');
  }

  // Classification Taxonomy: crawler | prefetch | scanner | probable_human | unknown
  let classification = 'unknown';
  let confidence = 0.50;

  if (isCrawler || riskScore >= 130) {
    classification = 'crawler';
    confidence = 0.98;
  } else if (isCliTool) {
    classification = 'scanner';
    confidence = 0.85;
  } else if (isPrefetch) {
    classification = 'prefetch';
    confidence = 0.90;
  } else if (isBrowser && riskScore <= 0) {
    classification = 'probable_human';
    confidence = secFetchUser === '?1' ? 0.95 : 0.85;
  } else if (riskScore >= 80) {
    classification = 'scanner';
    confidence = 0.80;
  } else if (isBrowser) {
    classification = 'probable_human';
    confidence = 0.80;
  } else {
    classification = 'unknown';
    confidence = 0.50;
  }

  return {
    classification,
    riskScore,
    confidence,
    signals,
    secFetchUser: secFetchUser || '',
    secFetchMode: secFetchMode || '',
    secFetchDest: secFetchDest || '',
    isCrawler,
    isPrefetch,
    isCliTool,
    isBrowser
  };
}

// Generate daily-rotated privacy-preserving IP hash
function generateDailyIpHash(ip, dateKey) {
  const secret = process.env.JWT_SECRET || 'medsos_agent_secure_salt';
  return crypto.createHmac('sha256', secret).update(`${ip || 'unknown'}_${dateKey}`).digest('hex').slice(0, 16);
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
// High-Confidence Instant Redirect with Event Ledger & Closed-Loop Attribution
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    // 1. Fetch shortlink document from Firestore
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
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    
    const now = new Date();
    const nowIso = now.toISOString();
    const dateKey = nowIso.split('T')[0];
    const hour = now.getHours();
    const nowEpoch = Date.now();

    // 2. Perform Multi-Signal Request & Traffic Source Analysis
    const analysis = analyzeRequest(req);
    const sourceAttribution = detectActualTrafficSource(referer, userAgent);
    const targetPlatform = String(data.platform || 'universal').toLowerCase();
    const ipHash = generateDailyIpHash(clientIp, dateKey);

    // 3. Counting Policy (Decoupled from Classifier)
    let countedAsHuman = false;
    let countingReason = 'unclassified';

    if (analysis.classification === 'probable_human') {
      countedAsHuman = true;
      countingReason = 'low_risk_navigation';
    } else if (analysis.classification === 'prefetch') {
      countedAsHuman = false;
      countingReason = 'prefetch_excluded';
    } else if (analysis.classification === 'crawler') {
      countedAsHuman = false;
      countingReason = 'crawler_excluded';
    } else if (analysis.classification === 'scanner') {
      countedAsHuman = false;
      countingReason = 'scanner_excluded';
    } else {
      countedAsHuman = false;
      countingReason = 'unknown_suppressed';
    }

    // 4. Perform Instant Zero-Latency HTTP 302 Redirect
    res.redirect(302, destination);

    // 5. Asynchronous Event Ledger & Materialized Counter Persistence
    setImmediate(async () => {
      try {
        const { device, os, browser } = parseDeviceAndOS(userAgent);

        const country = req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || 'ID';
        const city = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : 'Indonesia';
        
        // Sub-ID tracking tag if any
        const subId = data.tracking?.sub_publisher_id || data.tracking?.source || '';

        // A. Create Click Event Ledger Document (Source of Truth)
        const clickDocRef = db.collection('link_clicks').doc();
        const clickLog = {
          id: clickDocRef.id,
          code: code,
          user_id: data.user_id || 'system',
          product_id: data.product_id || '',
          product_title: data.title || data.product_title || 'Shopee Product',
          product_url: data.product_url || '',
          destination_url: destination,
          target_platform: targetPlatform,
          actual_source: sourceAttribution.actual_source,
          source_confidence: sourceAttribution.source_confidence,
          source_evidence: sourceAttribution.source_evidence,
          classification: analysis.classification,
          risk_score: analysis.riskScore,
          confidence: analysis.confidence,
          counted_as_human: countedAsHuman,
          counting_reason: countingReason,
          signals: analysis.signals,
          post_id: data.post_id || data.tracking?.post_id || '',
          account_id: data.account_id || data.tracking?.account_id || '',
          account_name: data.account_name || data.tracking?.account_name || '',
          referrer: referer.slice(0, 255),
          sec_fetch_user: analysis.secFetchUser,
          sec_fetch_mode: analysis.secFetchMode,
          sec_fetch_dest: analysis.secFetchDest,
          ip_hash: ipHash,
          device: (analysis.classification === 'crawler' || analysis.classification === 'scanner') ? 'Bot' : device,
          os: (analysis.classification === 'crawler' || analysis.classification === 'scanner') ? 'Crawler' : os,
          browser: browser,
          country: country,
          city: city,
          sub_id: subId,
          timestamp: nowIso,
          date: dateKey,
          hour: hour
        };

        // B. Atomic Updates to Materialized Counters in short_links
        const updatePayload = {
          total_clicks: FieldValue.increment(1),
          last_click_epoch: nowEpoch,
          last_clicked_at: nowIso,
          updated_at: nowIso
        };

        if (countedAsHuman) {
          updatePayload.human_clicks = FieldValue.increment(1);
        }

        if (analysis.classification === 'crawler') {
          updatePayload.crawler_clicks = FieldValue.increment(1);
          updatePayload.bot_clicks = FieldValue.increment(1); // Backward-compatibility
        } else if (analysis.classification === 'prefetch') {
          updatePayload.prefetch_clicks = FieldValue.increment(1);
        } else if (analysis.classification === 'scanner') {
          updatePayload.scanner_clicks = FieldValue.increment(1);
          updatePayload.bot_clicks = FieldValue.increment(1); // Backward-compatibility
        } else if (analysis.classification === 'unknown') {
          updatePayload.unknown_clicks = FieldValue.increment(1);
        }

        await Promise.all([
          docRef.update(updatePayload),
          clickDocRef.set(clickLog)
        ]);

        // C. Closed-Loop Continuous Learning Attribution:
        // Update product_post_memory ONLY for verified human hits
        if (countedAsHuman && code) {
          try {
            const memSnap = await db.collection('product_post_memory')
              .where('context_at_post.shortlink_code', '==', code)
              .get();

            const currentQuarter = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;

            if (!memSnap.empty) {
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

// Export helper functions for comprehensive unit testing
module.exports = router;
module.exports.analyzeRequest = analyzeRequest;
module.exports.detectActualTrafficSource = detectActualTrafficSource;
module.exports.generateDailyIpHash = generateDailyIpHash;
