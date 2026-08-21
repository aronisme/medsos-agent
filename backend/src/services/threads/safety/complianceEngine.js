const { checkUserCooldown, checkThreadLimit } = require('./cooldownService');
const { checkDailyReplyBudget } = require('./quotaService');

/**
 * Three-Tier Compliance Evaluation Engine
 * Menentukan keputusan final: ALLOW, BLOCK, atau REVIEW
 * @param {Object} context 
 * @param {string} context.userId 
 * @param {string} context.accountId 
 * @param {string} context.threadId 
 * @param {string} [context.authorId] 
 * @param {string} [context.productId] 
 * @param {'INBOUND'|'OUTBOUND'} context.actionType 
 * @param {string} [context.token] 
 */
async function evaluateCompliance(context) {
  const {
    userId,
    accountId,
    threadId,
    authorId = null,
    productId = null,
    actionType = 'INBOUND',
    token = null,
  } = context;

  // 1. TIER 1: Threads Rate Limit & Budget Check
  const budgetCheck = await checkDailyReplyBudget(userId, accountId, actionType, token);
  if (!budgetCheck.available) {
    return {
      decision: 'BLOCK',
      tier: 'TIER_1_QUOTA',
      reason: budgetCheck.reason,
    };
  }

  // 2. TIER 2: Collision & Cooldown Enforcement
  if (actionType === 'OUTBOUND') {
    // Utas hanya boleh 1 kali dibalas promosi outbound
    const threadCheck = await checkThreadLimit(userId, threadId, 1);
    if (threadCheck.limitReached) {
      return {
        decision: 'BLOCK',
        tier: 'TIER_2_THREAD_COLLISION',
        reason: threadCheck.reason,
      };
    }
  }

  // Pengguna yang sama tidak boleh menerima promosi berulang dalam 24 jam
  if (authorId) {
    const cooldownCheck = await checkUserCooldown(userId, authorId, 24);
    if (cooldownCheck.inCooldown) {
      return {
        decision: 'BLOCK',
        tier: 'TIER_2_USER_COOLDOWN',
        reason: cooldownCheck.reason,
      };
    }
  }

  // 3. TIER 3: Shopee Affiliate Rule Validation (Product & SKU)
  if (!productId) {
    return {
      decision: 'BLOCK',
      tier: 'TIER_3_SHOPEE_POLICY',
      reason: 'Tidak ada produk Shopee yang valid/terkait untuk dipromosikan.',
    };
  }

  return {
    decision: 'ALLOW',
    tier: 'PASSED',
    reason: 'Memenuhi seluruh kriteria kepatuhan 3-lapis.',
  };
}

module.exports = {
  evaluateCompliance,
};
