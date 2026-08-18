const axios = require('axios');

const GRAPH_VERSION = 'v21.0';
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Mengambil feed postingan dan interaksi dari Facebook Page
 * @param {string} pageId 
 * @param {string} accessToken 
 * @param {number} limit 
 * @returns {Promise<Array>} List of raw Facebook posts
 */
async function fetchFacebookPosts(pageId, accessToken, limit = 25) {
  if (!pageId || !accessToken) {
    throw new Error('Facebook pageId and accessToken are required.');
  }

  const cleanPageId = String(pageId).trim();
  const cleanToken = String(accessToken).trim();

  const response = await axios.get(`${BASE}/${cleanPageId}/feed`, {
    params: {
      access_token: cleanToken,
      fields: 'id,message,created_time,permalink_url,shares,reactions.summary(true),comments.summary(true),attachments{media,type,title,url,target}',
      limit,
    },
    timeout: 20000,
  });

  const posts = response.data?.data || [];

  return posts.map((post) => {
    let thumbnailUrl = '';
    let mediaType = 'STATUS';

    const attachment = post.attachments?.data?.[0];
    if (attachment) {
      thumbnailUrl = attachment.media?.image?.src || '';
      if (attachment.type?.includes('video')) {
        mediaType = 'VIDEO';
      } else if (attachment.type?.includes('photo') || attachment.type?.includes('album')) {
        mediaType = attachment.type.includes('album') ? 'CAROUSEL' : 'IMAGE';
      } else if (attachment.type?.includes('share') || attachment.type?.includes('link')) {
        mediaType = 'LINK';
      }
    }

    return {
      platform: 'facebook',
      page_id: cleanPageId,
      raw_post_id: post.id,
      caption: post.message || '',
      published_at: post.created_time || new Date().toISOString(),
      permalink: post.permalink_url || `https://www.facebook.com/${post.id}`,
      media_type: mediaType,
      thumbnail_url: thumbnailUrl,
      raw_post: post,
      raw_insights: null,
    };
  });
}

module.exports = {
  fetchFacebookPosts,
};
