const { db } = require('../../config/firebase');
const { fetchFacebookPosts } = require('./facebookAnalytics');
const { fetchInstagramPosts } = require('./instagramAnalytics');
const { fetchThreadsPosts } = require('./threadsAnalytics');
const { matchAffiliateLinks } = require('./linkMatcher');
const { normalizePost } = require('./normalizer');
const { captureSnapshot } = require('./snapshotService');
const { syncPostMemoryMetrics } = require('../agent/productPostMemoryService');
const { recordTemplatePerformance } = require('../agent/templateService');

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
    .where('is_active', 'in', [1, true, '1'])
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

  const syncTasks = [];
  const taskMeta = [];

  // Iterate over ALL active accounts to sync all pages/profiles per platform
  for (const acc of accounts) {
    if (acc.platform === 'facebook' && acc.access_token && acc.page_id) {
      taskMeta.push({ platform: 'facebook', account: acc });
      syncTasks.push(fetchFacebookPosts(acc.page_id, acc.access_token, limitPerPlatform));
    } else if (acc.platform === 'instagram' && acc.access_token && acc.page_id) {
      taskMeta.push({ platform: 'instagram', account: acc });
      syncTasks.push(fetchInstagramPosts(acc.page_id, acc.access_token, limitPerPlatform));
    } else if (acc.platform === 'threads' && acc.access_token) {
      taskMeta.push({ platform: 'threads', account: acc });
      syncTasks.push(fetchThreadsPosts(acc.page_id, acc.access_token, limitPerPlatform));
    }
  }

  // 2. Execute all platform fetches concurrently with Promise.allSettled
  const settledResults = await Promise.allSettled(syncTasks);

  const syncSummary = {
    facebook: { status: 'skipped', count: 0, error: null, accounts: [] },
    instagram: { status: 'skipped', count: 0, error: null, accounts: [] },
    threads: { status: 'skipped', count: 0, error: null, accounts: [] },
  };

  let allRawItems = [];

  settledResults.forEach((res, index) => {
    const meta = taskMeta[index];
    const platform = meta.platform;
    const accountName = meta.account.page_name || meta.account.username || meta.account.id;

    if (res.status === 'fulfilled') {
      const items = res.value || [];
      syncSummary[platform].status = 'success';
      syncSummary[platform].count += items.length;
      syncSummary[platform].accounts.push({ name: accountName, count: items.length, status: 'success' });
      // Attach account reference to raw items
      items.forEach(item => {
        allRawItems.push({ item, account: meta.account });
      });
    } else {
      const errMsg = res.reason?.response?.data?.error?.message || res.reason?.message || 'Gagal sinkronisasi';
      syncSummary[platform].accounts.push({ name: accountName, count: 0, status: 'failed', error: errMsg });
      if (syncSummary[platform].status !== 'success') {
        syncSummary[platform].status = 'failed';
        syncSummary[platform].error = errMsg;
      }
    }
  });

  // Pre-fetch user posts to link Meta posts back to posts collection
  const existingPostsSnap = await db.collection('posts')
    .where('user_id', 'in', [userId, 'system'])
    .limit(100)
    .get();

  const userPosts = existingPostsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Map platform post IDs and shortlinks to post objects
  const platformPostMap = new Map();
  userPosts.forEach(p => {
    if (Array.isArray(p.targets)) {
      p.targets.forEach(t => {
        if (t.post_id_on_platform) {
          platformPostMap.set(String(t.post_id_on_platform), p);
        }
      });
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

      // 4. Closed-Loop Sync: Cari kecocokan postingan dari database
      const matchedPost = platformPostMap.get(String(item.raw_post_id)) || null;
      const additionalText = matchedPost?.first_reply?.text || '';

      // Match affiliate links in caption or first_reply
      const affiliateData = await matchAffiliateLinks(item.caption, userId, additionalText);

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

      // Primary Attribution: Relasi Database ID > Fallback Regex Matcher
      const matchedProductId = matchedPost?.product_id || matchedPost?.first_reply?.product_id || affiliateData.short_links?.[0]?.product_id || null;
      const shortlinkCode = affiliateData.short_links?.[0]?.code || '';
      const totalClicks = normalized.affiliate?.human_clicks || normalized.affiliate?.total_clicks || 0;
      const rawViews = Number(normalized.metrics?.views) || Number(normalized.metrics?.reach) || 0;

      const rawMetrics = {
        views: rawViews,
        reach: Number(normalized.metrics?.reach) || rawViews,
        likes: Number(normalized.metrics?.likes) || 0,
        comments: (Number(normalized.metrics?.comments) || 0) + (Number(normalized.metrics?.replies) || 0),
        shares: (Number(normalized.metrics?.shares) || 0) + (Number(normalized.metrics?.reposts) || 0) + (Number(normalized.metrics?.quotes) || 0),
        saves: Number(normalized.metrics?.saves) || 0,
        affiliate_clicks: totalClicks,
      };

      const targetPostId = matchedPost ? matchedPost.id : docId;

      const fallbackContext = {
        product_id: matchedProductId,
        user_id: userId,
        platform: item.platform,
        account_id: account.id || account.page_id,
        account_name: account.page_name || account.name,
        shortlink_code: shortlinkCode,
        published_at: item.published_at || nowIso,
        posting_hour: new Date(item.published_at || nowIso).getHours(),
      };

      await syncPostMemoryMetrics(targetPostId, rawMetrics, fallbackContext);

      // 5. Update Multi-Armed Bandit Template Performance
      const matchedMemDoc = await db.collection('product_post_memory').doc(`mem_${targetPostId}`).get();
      const templateId = matchedMemDoc.exists ? matchedMemDoc.data()?.context_at_post?.template_id : null;
      if (templateId) {
        await recordTemplatePerformance(templateId, item.platform, 'clicks', rawViews, totalClicks);
      }

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
    .where('is_active', 'in', [1, true, '1'])
    .get();

  const accounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const getPlatformAccounts = (platform) => 
    accounts.filter(a => a.platform === platform && Boolean(a.access_token));

  const fbAccs = getPlatformAccounts('facebook');
  const igAccs = getPlatformAccounts('instagram');
  const thAccs = getPlatformAccounts('threads');

  return {
    facebook: {
      connected: fbAccs.length > 0,
      count: fbAccs.length,
      account_name: fbAccs.map(a => a.page_name || a.username || a.name || 'Facebook Page').join(', ') || null,
      accounts: fbAccs.map(a => ({ id: a.id, name: a.page_name || a.username || a.name, page_id: a.page_id })),
    },
    instagram: {
      connected: igAccs.length > 0,
      count: igAccs.length,
      account_name: igAccs.map(a => a.page_name || a.username || a.name || 'Instagram Account').join(', ') || null,
      accounts: igAccs.map(a => ({ id: a.id, name: a.page_name || a.username || a.name, page_id: a.page_id })),
    },
    threads: {
      connected: thAccs.length > 0,
      count: thAccs.length,
      account_name: thAccs.map(a => a.page_name || a.username || a.name || 'Threads Profile').join(', ') || null,
      accounts: thAccs.map(a => ({ id: a.id, name: a.page_name || a.username || a.name, page_id: a.page_id })),
    },
  };
}

module.exports = {
  syncAllPostsAnalytics,
  getPlatformConnectionStatus,
};
