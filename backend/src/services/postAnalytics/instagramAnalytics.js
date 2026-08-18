const axios = require('axios');

const GRAPH_VERSION = 'v21.0';
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Mengambil daftar media dan insights dari Akun Instagram Bisnis
 * @param {string} igUserId 
 * @param {string} accessToken 
 * @param {number} limit 
 * @returns {Promise<Array>} List of raw Instagram media with insights
 */
async function fetchInstagramPosts(igUserId, accessToken, limit = 25) {
  if (!igUserId || !accessToken) {
    throw new Error('Instagram igUserId and accessToken are required.');
  }

  const cleanIgId = String(igUserId).trim();
  const cleanToken = String(accessToken).trim();

  // 1. Fetch Media List
  const response = await axios.get(`${BASE}/${cleanIgId}/media`, {
    params: {
      access_token: cleanToken,
      fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,shortcode',
      limit,
    },
    timeout: 20000,
  });

  const mediaList = response.data?.data || [];

  // 2. Concurrently fetch insights for each media item
  const enrichedPosts = await Promise.all(
    mediaList.map(async (media) => {
      let rawInsights = null;
      const isVideo = media.media_type === 'VIDEO';

      // Graph API v21 valid metrics per media product type
      const metricQuery = isVideo
        ? 'views,reach,total_interactions,saved,shares,comments,likes,ig_reels_avg_watch_time,ig_reels_video_view_total_time'
        : 'reach,total_interactions,saved,shares,comments,likes';

      try {
        const insightsRes = await axios.get(`${BASE}/${media.id}/insights`, {
          params: {
            access_token: cleanToken,
            metric: metricQuery,
          },
          timeout: 10000,
        });
        rawInsights = insightsRes.data?.data || [];
      } catch (err) {
        // Fallback for older image/album types if certain metrics are unsupported
        try {
          const fallbackRes = await axios.get(`${BASE}/${media.id}/insights`, {
            params: {
              access_token: cleanToken,
              metric: 'reach,total_interactions,saved',
            },
            timeout: 8000,
          });
          rawInsights = fallbackRes.data?.data || [];
        } catch {
          rawInsights = null;
        }
      }

      return {
        platform: 'instagram',
        ig_user_id: cleanIgId,
        raw_post_id: media.id,
        caption: media.caption || '',
        published_at: media.timestamp || new Date().toISOString(),
        permalink: media.permalink || `https://www.instagram.com/p/${media.shortcode || media.id}/`,
        media_type: media.media_type || 'IMAGE',
        thumbnail_url: media.thumbnail_url || media.media_url || '',
        raw_post: media,
        raw_insights: rawInsights,
      };
    })
  );

  return enrichedPosts;
}

module.exports = {
  fetchInstagramPosts,
};
