const { get } = require('./threadsApiClient');

/**
 * Mengambil insight performa untuk sebuah postingan media Threads milik sendiri
 * @param {string} mediaId - ID Postingan
 * @param {string} token - Access Token
 * @param {string} [metrics] - Daftar metrik (views,likes,replies,reposts,quotes)
 */
async function getMediaInsights(mediaId, token, metrics = 'views,likes,replies,reposts,quotes') {
  const params = { metric: metrics };
  return await get(`${mediaId}/insights`, token, params);
}

/**
 * Mengambil insight level akun Threads milik sendiri
 * @param {string} threadsUserId - ID Akun Threads (atau 'me')
 * @param {string} token 
 * @param {string} [metrics] - Daftar metrik akun
 */
async function getUserInsights(threadsUserId, token, metrics = 'views,likes,replies,reposts,quotes') {
  const cleanUserId = threadsUserId ? String(threadsUserId).trim() : 'me';
  const params = { metric: metrics };
  return await get(`${cleanUserId}/threads_insights`, token, params);
}

module.exports = {
  getMediaInsights,
  getUserInsights,
};
