const express = require('express');
const axios = require('axios');
const db = require('../db');
const env = require('../config/env');
const router = express.Router();

const GRAPH_VERSION = 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * OAuth Facebook untuk MVP.
 * Catatan: Untuk dev (tanpa app review), flow ini berfungsi penuh untuk
 * user yang merupakan admin/test dari app (apps in development mode).
 *
 * Step 1: GET /api/auth/facebook — redirect ke Facebook login dialog
 * (perlu FB_APP_ID + FB_APP_SECRET di .env, dan redirect URI terdaftar)
 */
router.get('/facebook', (req, res) => {
  if (!env.fbAppId) {
    return res.status(400).json({
      error: 'FB_APP_ID belum diisi di .env. Untuk MVP, gunakan "Tambah Akun Manual" di dashboard.',
    });
  }
  const redirectUri = encodeURIComponent(`${env.baseUrl}/api/auth/facebook/callback`);
  const scope = encodeURIComponent(
    'pages_show_list,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,business_management'
  );
  const url = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?client_id=${env.fbAppId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
  res.redirect(url);
});

/**
 * Step 2: GET /api/auth/facebook/callback?code=...&state=...
 * - Tukar code → short-lived token
 * - Tukar → long-lived token (60 hari)
 * - Ambil pages + instagram_business_account
 * - Simpan ke social_accounts
 *
 * Catatan: Untuk demo sederhana tanpa session state, user token disimpan
 * sementara via parameter `state` (berisi user id bisa dipakai di produksi).
 * Di MVP ini: create/ambil demo user agar alur tetap terlihat.
 */
router.get('/facebook/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  try {
    // 1) Short-lived token
    const { data: tokenData } = await axios.get(`${GRAPH}/oauth/access_token`, {
      params: {
        client_id: env.fbAppId,
        client_secret: env.fbAppSecret,
        redirect_uri: `${env.baseUrl}/api/auth/facebook/callback`,
        code,
      },
    });

    // 2) Long-lived token (60 hari)
    const { data: longData } = await axios.get(`${GRAPH}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: env.fbAppId,
        client_secret: env.fbAppSecret,
        fb_exchange_token: tokenData.access_token,
      },
    });
    const longToken = longData.access_token;
    const expiresAt = new Date(Date.now() + (longData.expires_in || 60 * 24 * 3600) * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');

    // 3) Ambil pages
    const { data: pagesData } = await axios.get(`${GRAPH}/me/accounts`, {
      params: { access_token: longToken },
    });

    // Target user: cari/ambil demo user (di produksi: dari session/JWT)
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get('demo@demo.com');
    if (!user) {
      const r = db
        .prepare(`INSERT INTO users (name, email, password_hash) VALUES ('Demo User', 'demo@demo.com', 'oauth')`)
        .run();
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
    }

    let saved = 0;
    for (const page of pagesData.data || []) {
      const pageToken = page.access_token || longToken;
      db.prepare(
        `INSERT INTO social_accounts (user_id, platform, page_id, access_token, page_name, expires_at, is_active)
         VALUES (?, 'facebook', ?, ?, ?, 'Never', 1)
         ON CONFLICT (user_id, platform, page_id) DO UPDATE SET access_token = excluded.access_token, expires_at = 'Never', is_active = 1`
      ).run(user.id, page.id, pageToken, page.name);
      saved++;

      if (page.instagram_business_account) {
        db.prepare(
          `INSERT INTO social_accounts (user_id, platform, page_id, access_token, page_name, expires_at, is_active)
           VALUES (?, 'instagram', ?, ?, ?, 'Never', 1)
           ON CONFLICT (user_id, platform, page_id) DO UPDATE SET access_token = excluded.access_token, expires_at = 'Never', is_active = 1`
        ).run(user.id, page.instagram_business_account.id, pageToken, page.instagram_business_account.username);
        saved++;
      }
    }

    res.send(`
      <html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">
      <div style="text-align:center">
        <h2>✅ Berhasil terhubung!</h2>
        <p>${saved} akun tersimpan.</p>
        <p>Login manual: <b>demo@demo.com / demo1234</b></p>
        <a href="http://localhost:5173/dashboard/accounts">Kembali ke Dashboard</a>
      </div></body></html>
    `);
  } catch (e) {
    console.error('[oauth]', e?.response?.data || e.message);
    res.status(500).send('Gagal terhubung ke Facebook: ' + (e?.response?.data?.error?.message || e.message));
  }
});

module.exports = router;
