const { get } = require('./threadsApiClient');

/**
 * Mengambil informasi kuota pemakaian postingan dan reply resmi dari Meta
 * @param {string} [threadsUserId='me'] 
 * @param {string} token 
 */
async function getPublishingLimit(threadsUserId = 'me', token) {
  const cleanUserId = threadsUserId ? String(threadsUserId).trim() : 'me';
  const data = await get(`${cleanUserId}/threads_publishing_limit`, token, {
    fields: 'quota_usage,config,reply_quota_usage,reply_config'
  });

  return {
    postQuotaUsage: Number(data?.quota_usage) || 0,
    postQuotaTotal: Number(data?.config?.quota_total) || 250,
    postQuotaDuration: Number(data?.config?.quota_duration) || 86400,
    replyQuotaUsage: Number(data?.reply_quota_usage) || 0,
    replyQuotaTotal: Number(data?.reply_config?.quota_total) || 1000,
    replyQuotaDuration: Number(data?.reply_config?.quota_duration) || 86400,
    raw: data,
  };
}

module.exports = {
  getPublishingLimit,
};
