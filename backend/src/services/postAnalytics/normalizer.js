/**
 * Mengonversi output adapter platform menjadi satu objek standardized post analytics schema.
 * @param {Object} item Data mentah dari adapter (facebook, instagram, atau threads)
 * @param {Object} accountInfo Data akun sosial { id, name, username, platform }
 * @param {Object} affiliateData Data link affiliate hasil linkMatcher
 * @param {Object} existingPost Data postingan di Firestore jika sebelumnya sudah pernah disinkronkan
 * @returns {Object} Standardized post analytics object
 */
function normalizePost(item, accountInfo = {}, affiliateData = {}, existingPost = null) {
  const platform = item.platform;
  const nowIso = new Date().toISOString();

  let metrics = {
    views: null,
    reach: null,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: null,
    replies: null,
    reposts: null,
    quotes: null,
  };

  let videoMetrics = {
    avg_watch_time: null,
    total_view_time: null,
  };

  let metricSource = {
    views: null,
    reach: null,
    likes: 'meta_api',
    comments: 'meta_api',
    shares: 'meta_api',
    saves: null,
    replies: null,
    reposts: null,
    quotes: null,
    affiliate_clicks: 'firestore',
  };

  if (platform === 'facebook') {
    const raw = item.raw_post || {};
    metrics.likes = raw.reactions?.summary?.total_count || 0;
    metrics.comments = raw.comments?.summary?.total_count || 0;
    metrics.shares = raw.shares?.count || 0;
    metricSource.views = null;
    metricSource.reach = null;
  } else if (platform === 'instagram') {
    const raw = item.raw_post || {};
    const insights = item.raw_insights || [];

    // Map base counts from media object
    metrics.likes = raw.like_count || 0;
    metrics.comments = raw.comments_count || 0;

    // Extract metrics from insights API payload
    insights.forEach((ins) => {
      const val = ins.values?.[0]?.value ?? ins.total_value?.value ?? 0;
      switch (ins.name) {
        case 'views':
          metrics.views = Number(val);
          metricSource.views = 'meta_api';
          break;
        case 'reach':
          metrics.reach = Number(val);
          metricSource.reach = 'meta_api';
          break;
        case 'saved':
          metrics.saves = Number(val);
          metricSource.saves = 'meta_api';
          break;
        case 'shares':
          metrics.shares = Number(val);
          metricSource.shares = 'meta_api';
          break;
        case 'likes':
          metrics.likes = Number(val);
          break;
        case 'comments':
          metrics.comments = Number(val);
          break;
        case 'ig_reels_avg_watch_time':
          videoMetrics.avg_watch_time = Number(val);
          break;
        case 'ig_reels_video_view_total_time':
          videoMetrics.total_view_time = Number(val);
          break;
        default:
          break;
      }
    });
  } else if (platform === 'threads') {
    const insights = item.raw_insights || [];

    insights.forEach((ins) => {
      const val = ins.values?.[0]?.value ?? ins.total_value?.value ?? 0;
      switch (ins.name) {
        case 'views':
          metrics.views = Number(val);
          metricSource.views = 'meta_api';
          break;
        case 'likes':
          metrics.likes = Number(val);
          break;
        case 'replies':
          metrics.replies = Number(val);
          metricSource.replies = 'meta_api';
          metrics.comments = Number(val); // mirror to comments for uniform counting
          break;
        case 'reposts':
          metrics.reposts = Number(val);
          metricSource.reposts = 'meta_api';
          metrics.shares = Number(val); // mirror to shares
          break;
        case 'quotes':
          metrics.quotes = Number(val);
          metricSource.quotes = 'meta_api';
          break;
        default:
          break;
      }
    });
  }

  // Unified document ID
  const cleanPostId = String(item.raw_post_id).replace(/[^a-zA-Z0-9_]/g, '_');
  const unifiedId = `${platform}_${cleanPostId}`;

  return {
    id: unifiedId,
    identity: {
      platform,
      account_id: accountInfo.account_id || accountInfo.id || item.page_id || item.ig_user_id || item.threads_user_id || '',
      account_name: accountInfo.account_name || accountInfo.page_name || '',
      username: accountInfo.username || accountInfo.page_name || '',
      post_id: String(item.raw_post_id),
      permalink: item.permalink || '',
    },
    content: {
      caption: item.caption || '',
      media_type: item.media_type || 'STATUS',
      thumbnail_url: item.thumbnail_url || '',
      published_at: item.published_at || nowIso,
    },
    metrics,
    video_metrics: videoMetrics,
    metric_source: metricSource,
    affiliate: {
      short_links: affiliateData.short_links || [],
      total_clicks: affiliateData.total_clicks || 0,
      human_clicks: affiliateData.human_clicks || 0,
    },
    raw: {
      post_response: item.raw_post || {},
      insights_response: item.raw_insights || null,
    },
    sync: {
      first_synced_at: existingPost?.sync?.first_synced_at || nowIso,
      last_synced_at: nowIso,
      status: 'success',
      error: null,
    },
  };
}

module.exports = {
  normalizePost,
};
