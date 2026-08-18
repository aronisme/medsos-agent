const { db } = require('../../config/firebase');
const { fetchFacebookPosts } = require('./facebookAnalytics');
const { fetchInstagramPosts } = require('./instagramAnalytics');
const { fetchThreadsPosts } = require('./threadsAnalytics');
const { matchAffiliateLinks } = require('./linkMatcher');
const { normalizePost } = require('./normalizer');
const { captureSnapshot } = require('./snapshotService');

/**
 * Sinkronisasi penuh analitik multi-platform dari Meta API ke Firestore
 * @param {string} userId 
 * @param {Object} options 
 * @returns {Promise<Object>} Summary hasil sinkronisasi
 */
async function syncAllPostsAnalytics(userId, options = {}) {
  const limitPerPlatform = options.limit || 30;
  const nowIso = new Date().toISOString();

  // 1. Fetch user's active social accounts
  const accountsSnap = await db.collection('social_accounts')
    .where('user_id', '==', userId)
    .where('is_active', '==', 1)
    .get();

  if (accountsSnap.empty) {
    return {
      success: false,
      message: 'Tidak ada akun sosial media yang terhubung.',
      results: {},
      total_posts_synced: 0,
    };
  }

  const accounts = accountsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const fbAccount = accounts.find(a => a.platform === 'facebook');
  const igAccount = accounts.find(a => a.platform === 'instagram');
  const threadsAccount = accounts.find(a => a.platform === 'threads');

  const syncTasks = [];
  const taskMeta = [];

  // Task 1: Facebook
  if (fbAccount?.access_token && fbAccount?.page_id) {
    taskMeta.push({ platform: 'facebook', account: fbAccount });
    syncTasks.push(fetchFacebookPosts(fbAccount.page_id, fbAccount.access_token, limitPerPlatform));
  }

  // Task 2: Instagram
  if (igAccount?.access_token && igAccount?.page_id) {
    taskMeta.push({ platform: 'instagram', account: igAccount });
    syncTasks.push(fetchInstagramPosts(igAccount.page_id, igAccount.access_token, limitPerPlatform));
  }

  // Task 3: Threads
  if (threadsAccount?.access_token) {
    taskMeta.push({ platform: 'threads', account: threadsAccount });
    syncTasks.push(fetchThreadsPosts(threadsAccount.page_id, threadsAccount.access_token, limitPerPlatform));
  }

  // 2. Execute all platform fetches concurrently with Promise.allSettled
  const settledResults = await Promise.allSettled(syncTasks);

  const syncSummary = {
    facebook: { status: 'skipped', count: 0, error: null },
    instagram: { status: 'skipped', count: 0, error: null },
    threads: { status: 'skipped', count: 0, error: null },
  };

  let allRawItems = [];

  settledResults.forEach((res, index) => {
    const meta = taskMeta[index];
    const platform = meta.platform;

    if (res.status === 'fulfilled') {
      const items = res.value || [];
      syncSummary[platform] = {
        status: 'success',
        count: items.length,
        error: null,
      };
      // Attach account reference to raw items
      items.forEach(item => {
        allRawItems.push({ item, account: meta.account });
      });
    } else {
      const errMsg = res.reason?.response?.data?.error?.message || res.reason?.message || 'Gagal sinkronisasi';
      syncSummary[platform] = {
        status: 'failed',
        count: 0,
        error: errMsg,
      };
    }
  });

  // 3. Normalize, match affiliate links, save to Firestore, and create snapshot
  let totalSaved = 0;

  for (const { item, account } of allRawItems) {
    try {
      const cleanPostId = String(item.raw_post_id).replace(/[^a-zA-Z0-9_]/g, '_');
      const docId = `${item.platform}_${cleanPostId}`;

      // Check existing document
      const existingDoc = await db.collection('post_analytics').doc(docId).get();
      const existingData = existingDoc.exists ? existingDoc.data() : null;

      // Match affiliate links in caption
      const affiliateData = await matchAffiliateLinks(item.caption, userId);

      // Normalize
      const normalized = normalizePost(
        item,
        {
          account_id: account.id || account.page_id,
          account_name: account.page_name || account.name || item.platform,
          username: account.username || account.page_name || '',
          platform: item.platform,
        },
        affiliateData,
        existingData
      );

      normalized.user_id = userId;

      // Save / Update to post_analytics collection
      await db.collection('post_analytics').doc(docId).set(normalized, { merge: true });

      // Save historical snapshot
      await captureSnapshot(normalized, userId);

      totalSaved++;
    } catch (err) {
      console.error(`Error saving post analytics ${item.raw_post_id}:`, err.message);
    }
  }

  // Update user's last synced timestamp in social_accounts / settings
  const lastSyncRecord = {
    user_id: userId,
    last_synced_at: nowIso,
    summary: syncSummary,
    total_posts: totalSaved,
  };
  await db.collection('analytics_meta').doc(userId).set(lastSyncRecord, { merge: true });

  return {
    success: true,
    synced_at: nowIso,
    results: syncSummary,
    total_posts_synced: totalSaved,
  };
}

/**
 * Mengambil status koneksi token masing-masing platform
 */
async function getPlatformConnectionStatus(userId) {
  const accountsSnap = await db.collection('social_accounts')
    .where('user_id', '==', userId)
    .where('is_active', '==', 1)
    .get();

  const accounts = accountsSnap.docs.map(d => d.data());

  return {
    facebook: {
      connected: accounts.some(a => a.platform === 'facebook' && Boolean(a.access_token)),
      account_name: accounts.find(a => a.platform === 'facebook')?.page_name || null,
    },
    instagram: {
      connected: accounts.some(a => a.platform === 'instagram' && Boolean(a.access_token)),
      account_name: accounts.find(a => a.platform === 'instagram')?.page_name || null,
    },
    threads: {
      connected: accounts.some(a => a.platform === 'threads' && Boolean(a.access_token)),
      account_name: accounts.find(a => a.platform === 'threads')?.page_name || null,
    },
  };
}

module.exports = {
  syncAllPostsAnalytics,
  getPlatformConnectionStatus,
};
