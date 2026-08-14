const express = require('express');
const axios = require('axios');
const { db } = require('../config/firebase');
const env = require('../config/env');
const router = express.Router();

const GRAPH_VERSION = 'v21.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

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

router.get('/facebook/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing code');

  try {
    const { data: tokenData } = await axios.get(`${GRAPH}/oauth/access_token`, {
      params: {
        client_id: env.fbAppId,
        client_secret: env.fbAppSecret,
        redirect_uri: `${env.baseUrl}/api/auth/facebook/callback`,
        code,
      },
    });

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
      .toISOString();

    const { data: pagesData } = await axios.get(`${GRAPH}/me/accounts`, {
      params: { access_token: longToken },
    });

    // Cari user demo (di produksi harusnya ambil dari session/JWT state)
    const userSnap = await db.collection('users').where('email', '==', 'owner@medsos.local').limit(1).get();
    let userId;
    if (userSnap.empty) {
      const newUser = await db.collection('users').add({
        name: 'Owner Medsos',
        email: 'owner@medsos.local',
        password_hash: 'oauth',
        created_at: new Date().toISOString()
      });
      userId = newUser.id;
    } else {
      userId = userSnap.docs[0].id;
    }

    let saved = 0;
    
    // Helper function for upsert
    const upsertAccount = async (platform, page_id, access_token, page_name) => {
      const snap = await db.collection('social_accounts')
        .where('user_id', '==', userId)
        .where('platform', '==', platform)
        .where('page_id', '==', page_id)
        .limit(1)
        .get();
        
      if (snap.empty) {
        await db.collection('social_accounts').add({
          user_id: userId,
          platform,
          page_id,
          access_token,
          page_name,
          expires_at: 'Never',
          is_active: 1,
          created_at: new Date().toISOString()
        });
      } else {
        await snap.docs[0].ref.update({
          access_token,
          page_name,
          expires_at: 'Never',
          is_active: 1
        });
      }
    };

    for (const page of pagesData.data || []) {
      const pageToken = page.access_token || longToken;
      await upsertAccount('facebook', page.id, pageToken, page.name);
      saved++;

      if (page.instagram_business_account) {
        await upsertAccount('instagram', page.instagram_business_account.id, pageToken, page.instagram_business_account.username || page.name);
        saved++;
      }
    }

    res.send(`
      <html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh">
      <div style="text-align:center">
        <h2>✅ Berhasil terhubung!</h2>
        <p>${saved} akun tersimpan.</p>
        <p>Silakan kembali ke aplikasi.</p>
        <a href="http://localhost:5173/dashboard/accounts">Kembali ke Dashboard</a>
      </div></body></html>
    `);
  } catch (e) {
    console.error('[oauth]', e?.response?.data || e.message);
    res.status(500).send('Gagal terhubung ke Facebook: ' + (e?.response?.data?.error?.message || e.message));
  }
});

module.exports = router;
