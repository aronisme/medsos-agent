const { db } = require('../../../config/firebase');
const { getPublishingLimit } = require('../api/threadsQuotaApi');

const DEFAULT_CONFIG = {
  inbound_daily_limit: 50,
  outbound_daily_limit: 10,
  search_observed_limit: 500,
  search_rolling_window_days: 7,
};

/**
 * Memeriksa apakah budget reply harian akun masih tersedia
 * @param {string} userId 
 * @param {string} accountId 
 * @param {'INBOUND'|'OUTBOUND'} type 
 * @param {string} [token] 
 */
async function checkDailyReplyBudget(userId, accountId, type = 'INBOUND', token = null) {
  try {
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const docId = `quota_${accountId}_${todayStr}`;
    const docRef = db.collection('threads_rate_limits').doc(docId);
    const doc = await docRef.get();

    const data = doc.exists ? doc.data() : { inbound_count: 0, outbound_count: 0 };
    const maxLimit = type === 'INBOUND' ? DEFAULT_CONFIG.inbound_daily_limit : DEFAULT_CONFIG.outbound_daily_limit;
    const currentUsage = type === 'INBOUND' ? (data.inbound_count || 0) : (data.outbound_count || 0);

    if (currentUsage >= maxLimit) {
      return {
        available: false,
        reason: `Budget harian ${type} (${currentUsage}/${maxLimit}) untuk akun ${accountId} sudah tercapai hari ini.`,
        currentUsage,
        maxLimit,
      };
    }

    // Jika token disediakan, cek juga hard limit resmi Meta (1000 reply/day)
    if (token) {
      try {
        const metaLimit = await getPublishingLimit('me', token);
        if (metaLimit.replyQuotaUsage >= metaLimit.replyQuotaTotal) {
          return {
            available: false,
            reason: `Hard limit reply resmi Meta (${metaLimit.replyQuotaUsage}/${metaLimit.replyQuotaTotal}) sudah habis.`,
            currentUsage: metaLimit.replyQuotaUsage,
            maxLimit: metaLimit.replyQuotaTotal,
          };
        }
      } catch (_) {}
    }

    return {
      available: true,
      currentUsage,
      maxLimit,
    };
  } catch (err) {
    console.warn('[QuotaService] Error checking reply budget:', err.message);
    return { available: true, currentUsage: 0, maxLimit: 50 };
  }
}

/**
 * Mencatat penambahan konsumsi reply untuk hari ini
 */
async function incrementReplyUsage(userId, accountId, type = 'INBOUND') {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const docId = `quota_${accountId}_${todayStr}`;
    const docRef = db.collection('threads_rate_limits').doc(docId);
    const doc = await docRef.get();

    const field = type === 'INBOUND' ? 'inbound_count' : 'outbound_count';
    const currentVal = doc.exists ? (doc.data()[field] || 0) : 0;

    await docRef.set({
      user_id: userId,
      account_id: accountId,
      date: todayStr,
      [field]: currentVal + 1,
      updated_at: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    console.warn('[QuotaService] Warning incrementing reply usage:', err.message);
  }
}

module.exports = {
  checkDailyReplyBudget,
  incrementReplyUsage,
  DEFAULT_CONFIG,
};
