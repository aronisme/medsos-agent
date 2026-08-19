const axios = require('axios');
const { db } = require('../config/firebase');

const GRAPH_VERSION = 'v21.0';
const FB_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Memperbarui Long-Lived Token Threads untuk akun aktif (60 hari)
 */
async function refreshThreadsAccount(docRef, acc) {
  const token = acc.access_token;
  if (!token) return { success: false, reason: 'No token' };

  try {
    const { data } = await axios.get('https://graph.threads.net/refresh_access_token', {
      params: {
        grant_type: 'th_refresh_token',
        access_token: token,
      },
      timeout: 10000,
    });

    if (data?.access_token) {
      await docRef.update({
        access_token: data.access_token,
        token_expires_in: data.expires_in || 5184000,
        token_type: 'long_lived_60d',
        last_refreshed_at: new Date().toISOString(),
        is_valid: true,
      });
      return { success: true, platform: 'threads', expires_in: data.expires_in };
    }
  } catch (err) {
    // Jika belum 60-day, coba exchange via THREADS_APP_SECRET
    const appSecret = process.env.THREADS_APP_SECRET || process.env.FB_APP_SECRET;
    if (appSecret) {
      try {
        const { data: exData } = await axios.get('https://graph.threads.net/access_token', {
          params: {
            grant_type: 'th_exchange_token',
            client_secret: appSecret,
            access_token: token,
          },
          timeout: 10000,
        });
        if (exData?.access_token) {
          await docRef.update({
            access_token: exData.access_token,
            token_expires_in: exData.expires_in || 5184000,
            token_type: 'long_lived_60d',
            last_refreshed_at: new Date().toISOString(),
            is_valid: true,
          });
          return { success: true, platform: 'threads', expires_in: exData.expires_in };
        }
      } catch (exErr) {}
    }
    return { success: false, reason: err.response?.data?.error?.message || err.message };
  }
}

/**
 * Memperbarui / Memvalidasi Token Facebook Page & Instagram Business
 */
async function refreshFbIgAccount(docRef, acc) {
  const token = acc.access_token;
  if (!token) return { success: false, reason: 'No token' };

  const appId = process.env.FB_APP_ID;
  const appSecret = process.env.FB_APP_SECRET;
  if (!appId || !appSecret) {
    return { success: false, reason: 'FB_APP_ID / FB_APP_SECRET not configured' };
  }

  const appToken = `${appId}|${appSecret}`;

  try {
    // 1. Debug status token via Meta Debug API
    const { data: debugRes } = await axios.get(`${FB_BASE}/debug_token`, {
      params: {
        input_token: token,
        access_token: appToken,
      },
      timeout: 10000,
    });

    const info = debugRes?.data;
    if (!info?.is_valid) {
      return { success: false, reason: 'Token ditandai tidak valid oleh Meta' };
    }

    // Jika Page token permanen (expires_at == 0 atau Type: PAGE)
    if (info.expires_at === 0 || info.type === 'PAGE') {
      await docRef.update({
        token_type: 'permanent_never_expires',
        is_valid: true,
        data_access_expires_at: info.data_access_expires_at ? new Date(info.data_access_expires_at * 1000).toISOString() : null,
        last_checked_at: new Date().toISOString(),
      });
      return { success: true, platform: acc.platform, type: 'permanent_never_expires' };
    }

    // Jika User Token yang mendekati expired (< 15 hari), exchange ke Long-Lived Token 60 hari
    const nowSec = Math.floor(Date.now() / 1000);
    const timeLeft = (info.expires_at || 0) - nowSec;

    if (timeLeft < 15 * 86400 && info.expires_at !== 0) {
      const { data: exData } = await axios.get(`${FB_BASE}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: token,
        },
        timeout: 10000,
      });

      if (exData?.access_token) {
        await docRef.update({
          access_token: exData.access_token,
          token_type: 'long_lived_60d',
          token_expires_in: exData.expires_in,
          last_refreshed_at: new Date().toISOString(),
          is_valid: true,
        });
        return { success: true, platform: acc.platform, type: 'long_lived_60d' };
      }
    }

    await docRef.update({
      is_valid: true,
      last_checked_at: new Date().toISOString(),
    });
    return { success: true, platform: acc.platform, type: info.type || 'valid' };
  } catch (err) {
    return { success: false, reason: err.response?.data?.error?.message || err.message };
  }
}

/**
 * Orkestrasi Refresh Otomatis Seluruh Akun (FB, IG, Threads)
 */
async function autoRefreshAllTokens() {
  const results = [];
  try {
    const snap = await db.collection('social_accounts')
      .where('is_active', 'in', [1, true, '1'])
      .get();

    for (const doc of snap.docs) {
      const acc = doc.data();
      let res;
      if (acc.platform === 'threads') {
        res = await refreshThreadsAccount(doc.ref, acc);
      } else if (acc.platform === 'facebook' || acc.platform === 'instagram') {
        res = await refreshFbIgAccount(doc.ref, acc);
      }
      results.push({ accountId: doc.id, name: acc.page_name, platform: acc.platform, ...res });
    }
  } catch (err) {
    console.error('[TokenRefreshService] Error autoRefreshAllTokens:', err.message);
  }
  return results;
}

module.exports = {
  autoRefreshAllTokens,
  refreshThreadsAccount,
  refreshFbIgAccount,
};
