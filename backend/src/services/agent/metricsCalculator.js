/**
 * Metrics Calculator & Statistical Engine
 * Menghitung metrik normalisasi, decomposed scores (Viral != Profitable),
 * dan statistical confidence untuk A/B testing secara empiris.
 */

/**
 * Normalisasi metrik mentah menjadi rates
 * @param {Object} rawMetrics - { views, reach, likes, comments, shares, saves, affiliate_clicks }
 * @returns {Object} normalized_metrics
 */
function normalizeMetrics(rawMetrics = {}) {
  const views = Math.max(Number(rawMetrics.views) || Number(rawMetrics.reach) || 0, 0);
  const likes = Math.max(Number(rawMetrics.likes) || 0, 0);
  const comments = Math.max(Number(rawMetrics.comments) || 0, 0);
  const shares = Math.max(Number(rawMetrics.shares) || 0, 0);
  const reposts = Math.max(Number(rawMetrics.reposts) || 0, 0);
  const saves = Math.max(Number(rawMetrics.saves) || 0, 0);
  const clicks = Math.max(Number(rawMetrics.affiliate_clicks) || 0, 0);

  // Jika views 0, gunakan basis 1 untuk menghindari division by zero
  const baseViews = views > 0 ? views : 1;

  const likeRate = views > 0 ? likes / baseViews : 0;
  const commentRate = views > 0 ? comments / baseViews : 0;
  const shareRate = views > 0 ? shares / baseViews : 0;
  const repostRate = views > 0 ? reposts / baseViews : 0;
  const saveRate = views > 0 ? saves / baseViews : 0;
  const clickThroughRate = views > 0 ? clicks / baseViews : 0;
  const viralDistributionRate = views > 0 ? (shares + reposts) / baseViews : 0;

  // Custom weighted engagement score:
  // Di Threads/FB, Shares & Reposts (4x) serta Saves (3x) bernilai eksponensial dalam algoritma rekomendasi dibanding Likes (1x)
  const weightedEngScore = views > 0 
    ? (likes * 1 + comments * 2 + shares * 4 + reposts * 4 + saves * 3) / baseViews 
    : 0;

  return {
    views,
    likes,
    comments,
    shares,
    reposts,
    saves,
    affiliate_clicks: clicks,
    like_rate: Number(likeRate.toFixed(4)),
    comment_rate: Number(commentRate.toFixed(4)),
    share_rate: Number(shareRate.toFixed(4)),
    repost_rate: Number(repostRate.toFixed(4)),
    save_rate: Number(saveRate.toFixed(4)),
    viral_distribution_rate: Number(viralDistributionRate.toFixed(4)),
    click_through_rate: Number(clickThroughRate.toFixed(4)),
    weighted_engagement_score: Number(weightedEngScore.toFixed(4)),
  };
}

/**
 * Menghitung Decomposed Scores (Skala 1 - 10)
 * Memisahkan reach, engagement, click, dan conversion
 * @param {Object} normalized - output dari normalizeMetrics
 * @param {string} objective - 'clicks' | 'engagement' | 'awareness' | 'conversion'
 * @param {Object} accountBaselines - rata-rata performa akun { avg_views, avg_ctr, avg_eng }
 * @returns {Object} scores
 */
function calculateDecomposedScores(normalized, objective = 'clicks', accountBaselines = {}) {
  const avgViews = accountBaselines.avg_views || 1000;
  const avgCtr = accountBaselines.avg_ctr || 0.015; // default 1.5% CTR
  const avgEng = accountBaselines.avg_eng || 0.03; // default 3% engagement

  // 1. Reach Score (relatif terhadap baseline akun, capped 1-10)
  const reachRatio = (normalized.views || 0) / Math.max(avgViews, 1);
  const reachScore = Math.min(Math.max(Number((reachRatio * 5).toFixed(1)), 1), 10);

  // 2. Engagement Score (relatif terhadap baseline engagement)
  const engRatio = normalized.weighted_engagement_score / Math.max(avgEng, 0.001);
  const engagementScore = Math.min(Math.max(Number((engRatio * 5).toFixed(1)), 1), 10);

  // 3. Click Score (Golden Metric untuk affiliate marketing)
  // CTR 3%+ dinilai sangat bagus (skor > 8)
  const ctrRatio = normalized.click_through_rate / Math.max(avgCtr, 0.001);
  const clickScore = Math.min(Math.max(Number((ctrRatio * 5).toFixed(1)), 1), 10);

  // 4. Conversion Proxy Score (berbasis jumlah klik mutlak dan CTR)
  const absoluteClickBonus = Math.min((normalized.affiliate_clicks || 0) / 10, 5); // bonus hingga +5 jika banyak klik
  const conversionScore = Math.min(Math.max(Number(((clickScore * 0.6) + absoluteClickBonus).toFixed(1)), 1), 10);

  // 5. Objective-Aligned Overall Score
  let overallScore = 5.0;
  if (objective === 'clicks') {
    // Bobot: 60% Click, 20% Engagement, 20% Reach
    overallScore = Number((clickScore * 0.6 + engagementScore * 0.2 + reachScore * 0.2).toFixed(1));
  } else if (objective === 'conversion') {
    // Bobot: 70% Conversion/Clicks, 15% Engagement, 15% Reach
    overallScore = Number((conversionScore * 0.7 + clickScore * 0.15 + reachScore * 0.15).toFixed(1));
  } else if (objective === 'awareness') {
    // Bobot: 60% Reach, 30% Engagement, 10% Click
    overallScore = Number((reachScore * 0.6 + engagementScore * 0.3 + clickScore * 0.1).toFixed(1));
  } else {
    // Default Engagement objective
    overallScore = Number((engagementScore * 0.5 + reachScore * 0.3 + clickScore * 0.2).toFixed(1));
  }

  return {
    reach_score: reachScore,
    engagement_score: engagementScore,
    click_score: clickScore,
    conversion_score: conversionScore,
    objective_aligned_score: overallScore,
    overall_score: overallScore,
  };
}

/**
 * Menghitung Statistical Comparison & Confidence untuk A/B Testing
 * @param {Object} variantA - { views, clicks, ctr }
 * @param {Object} variantB - { views, clicks, ctr }
 * @returns {Object} { winner_variant, ctr_difference, relative_lift, confidence_level, sample_size_total }
 */
function evaluateABExperiment(variantA, variantB) {
  const viewsA = Number(variantA.views) || 0;
  const clicksA = Number(variantA.clicks) || 0;
  const ctrA = viewsA > 0 ? clicksA / viewsA : 0;

  const viewsB = Number(variantB.views) || 0;
  const clicksB = Number(variantB.clicks) || 0;
  const ctrB = viewsB > 0 ? clicksB / viewsB : 0;

  const sampleSizeTotal = viewsA + viewsB;
  const ctrDiff = ctrB - ctrA;
  const absCtrDiff = Math.abs(ctrDiff);
  
  const baseCtr = Math.min(ctrA, ctrB) || 0.001;
  const relativeLift = ctrA > 0 
    ? Number((((ctrB - ctrA) / ctrA) * 100).toFixed(1)) 
    : (ctrB > 0 ? 100 : 0);

  const winnerVariant = ctrB > ctrA ? 'B' : (ctrA > ctrB ? 'A' : 'TIE');

  // Empirical Confidence Level Heuristics
  let confidenceLevel = 'preliminary';

  if (sampleSizeTotal >= 5000 && absCtrDiff >= 0.005) {
    confidenceLevel = 'high';
  } else if (sampleSizeTotal >= 1000 && Math.abs(relativeLift) >= 20) {
    confidenceLevel = 'medium';
  } else {
    confidenceLevel = 'preliminary';
  }

  return {
    winner_variant: winnerVariant,
    ctr_a: Number(ctrA.toFixed(4)),
    ctr_b: Number(ctrB.toFixed(4)),
    ctr_difference: Number(ctrDiff.toFixed(4)),
    relative_lift: `${relativeLift > 0 ? '+' : ''}${relativeLift}%`,
    confidence_level: confidenceLevel,
    sample_size_total: sampleSizeTotal,
    evaluated_at: new Date().toISOString()
  };
}

module.exports = {
  normalizeMetrics,
  calculateDecomposedScores,
  evaluateABExperiment,
};
