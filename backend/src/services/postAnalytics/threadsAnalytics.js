const axios = require('axios');

const GRAPH_VERSION = 'v1.0';
const BASE = `https://graph.threads.net/${GRAPH_VERSION}`;

/**
 * Mengambil daftar thread dan insights dari Akun Meta Threads
 * @param {string} threadsUserId 
 * @param {string} accessToken 
 * @param {number} limit 
 * @returns {Promise<Array>} List of raw Threads posts with insights
 */
async function fetchThreadsPosts(threadsUserId, accessToken, limit = 25) {
  if (!accessToken) {
    throw new Error('Threads accessToken is required.');
  }

  const cleanToken = String(accessToken).trim();
  const cleanUserId = threadsUserId ? String(threadsUserId).trim() : 'me';

  // 1. Fetch Threads List
  const response = await axios.get(`${BASE}/${cleanUserId}/threads`, {
    params: {
      access_token: cleanToken,
      fields: 'id,media_product_type,media_type,text,permalink,timestamp,shortcode,is_quote_post',
      limit,
    },
    timeout: 20000,
  });

  const threadList = response.data?.data || [];

  // 2. Concurrently fetch insights for each thread
  const enrichedPosts = await Promise.all(
    threadList.map(async (thread) => {
      let rawInsights = null;
      try {
        const insightsRes = await axios.get(`${BASE}/${thread.id}/insights`, {
          params: {
            access_token: cleanToken,
            metric: 'views,likes,replies,reposts,quotes',
          },
          timeout: 10000,
        });
        rawInsights = insightsRes.data?.data || [];
      } catch (err) {
        rawInsights = null;
      }

      return {
        platform: 'threads',
        threads_user_id: cleanUserId,
        raw_post_id: thread.id,
        caption: thread.text || '',
        published_at: thread.timestamp || new Date().toISOString(),
        permalink: thread.permalink || `https://www.threads.net/post/${thread.shortcode || thread.id}`,
        media_type: thread.media_type || 'TEXT_POST',
        thumbnail_url: '', // Threads API text posts do not have image thumbnails unless embedded
        raw_post: thread,
        raw_insights: rawInsights,
      };
    })
  );

  return enrichedPosts;
}

module.exports = {
  fetchThreadsPosts,
};
