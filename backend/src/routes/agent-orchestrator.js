const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const { authRequired } = require('../middleware/auth');
const {
  runAutonomousCycle,
  getAgentConfig,
  updateAgentConfig
} = require('../services/agent/orchestratorService');
const {
  getProductPostHistory,
  getCurrentQuarter
} = require('../services/agent/productPostMemoryService');
const { getProductDecisions } = require('../services/agent/decisionLogger');
const { getActiveKnowledgeInsights, synthesizeKnowledge } = require('../services/agent/knowledgeSynthesizer');
const { getExperiments, evaluateExperiment } = require('../services/agent/experimentService');
const { diagnoseProductPerformance } = require('../services/agent/diagnosticService');

router.use(authRequired);

/**
 * POST /api/agent/cycle/run
 * Memicu 1 putaran siklus otonom secara langsung
 */
router.post('/cycle/run', async (req, res) => {
  try {
    const userId = req.user.id;
    const { forceRun = true, maxPosts = 4 } = req.body || {};
    const result = await runAutonomousCycle(userId, { forceRun, maxPostsToSchedule: maxPosts });
    res.json(result);
  } catch (err) {
    console.error('[POST /agent/cycle/run Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/agent/quarter/status
 * Status kemajuan kuartal, ringkasan produk di setiap fase lifecycle
 */
router.get('/quarter/status', async (req, res) => {
  try {
    const userId = req.user.id;
    const currentQuarter = getCurrentQuarter();

    const prodSnap = await db.collection('affiliate_products')
      .where('user_id', '==', userId)
      .get();

    const products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const lifecycleBreakdown = {
      NEW: [],
      TESTING: [],
      PROMISING: [],
      PROVEN: [],
      SCALING: [],
      COOLING: [],
      STOPPED: [],
    };

    let totalQuarterViews = 0;
    let totalQuarterClicks = 0;

    products.forEach(p => {
      const status = p.lifecycle_status || (p.quarterly_status?.status === 'stopped_for_quarter' ? 'STOPPED' : 'NEW');
      if (lifecycleBreakdown[status]) {
        lifecycleBreakdown[status].push(p);
      } else {
        lifecycleBreakdown.NEW.push(p);
      }

      if (p.quarterly_summary) {
        totalQuarterViews += p.quarterly_summary.total_views || 0;
        totalQuarterClicks += p.quarterly_summary.total_clicks || 0;
      }
    });

    // Ambil akumulasi views & clicks dari post_analytics agar data selalu sinkron dengan Meta API & Link Tracker
    const postAnalyticsSnap = await db.collection('post_analytics')
      .where('user_id', 'in', [userId, 'system'])
      .get();

    let totalGlobalViews = 0;
    let totalGlobalClicks = 0;

    postAnalyticsSnap.docs.forEach(doc => {
      const d = doc.data();
      const views = Number(d.metrics?.views) || Number(d.metrics?.reach) || 0;
      const clicks = Number(d.affiliate?.human_clicks) || Number(d.affiliate?.total_clicks) || 0;
      totalGlobalViews += views;
      totalGlobalClicks += clicks;
    });

    const finalViews = Math.max(totalQuarterViews, totalGlobalViews);
    const finalClicks = Math.max(totalQuarterClicks, totalGlobalClicks);
    const avgQuarterCtr = finalViews > 0
      ? Number(((finalClicks / finalViews) * 100).toFixed(2))
      : (finalClicks > 0 ? 100 : 0);

    res.json({
      success: true,
      current_quarter: currentQuarter,
      total_products: products.length,
      total_views: finalViews,
      total_clicks: finalClicks,
      avg_ctr: avgQuarterCtr,
      breakdown: {
        new_count: lifecycleBreakdown.NEW.length,
        testing_count: lifecycleBreakdown.TESTING.length,
        promising_count: lifecycleBreakdown.PROMISING.length,
        proven_count: lifecycleBreakdown.PROVEN.length,
        scaling_count: lifecycleBreakdown.SCALING.length,
        cooling_count: lifecycleBreakdown.COOLING.length,
        stopped_count: lifecycleBreakdown.STOPPED.length,
      },
      pools: lifecycleBreakdown
    });
  } catch (err) {
    console.error('[GET /agent/quarter/status Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/agent/memory/product/:id
 * Mengambil buku besar riwayat postingan produk
 */
router.get('/memory/product/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const history = await getProductPostHistory(id, 50);
    const decisions = await getProductDecisions(req.user.id, id, 10);

    res.json({
      success: true,
      product_id: id,
      post_count: history.length,
      history,
      decisions
    });
  } catch (err) {
    console.error('[GET /agent/memory/product/:id Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/agent/decisions
 * Mengambil log keputusan AI secara keseluruhan untuk transparansi
 */
router.get('/decisions', async (req, res) => {
  try {
    const { limit = 50, product_id } = req.query;
    const logs = await getProductDecisions(req.user.id, product_id, parseInt(limit, 10) || 50);
    res.json({ success: true, decisions: logs });
  } catch (err) {
    console.error('[GET /agent/decisions Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/agent/insights
 * Mengambil actionable insights dari Knowledge Layer
 */
router.get('/insights', async (req, res) => {
  try {
    const insights = await getActiveKnowledgeInsights(req.user.id);
    res.json({ success: true, insights });
  } catch (err) {
    console.error('[GET /agent/insights Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/agent/experiments
 * Mengambil daftar A/B testing eksperimen
 */
router.get('/experiments', async (req, res) => {
  try {
    const { quarter } = req.query;
    const experiments = await getExperiments(req.user.id, quarter);
    res.json({ success: true, experiments });
  } catch (err) {
    console.error('[GET /agent/experiments Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/agent/experiments/:id/evaluate
 * Evaluasi eksperimen A/B tertentu
 */
router.post('/experiments/:id/evaluate', async (req, res) => {
  try {
    const result = await evaluateExperiment(req.params.id);
    res.json({ success: true, experiment: result });
  } catch (err) {
    console.error('[POST /agent/experiments/:id/evaluate Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/agent/product/:id/diagnose
 * Memicu analisis diagnostik manual untuk suatu produk
 */
router.post('/product/:id/diagnose', async (req, res) => {
  try {
    const result = await diagnoseProductPerformance(req.params.id, req.user.id);
    res.json({ success: true, diagnosis: result });
  } catch (err) {
    console.error('[POST /agent/product/:id/diagnose Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/agent/product/:id/override-status
 * User secara manual mengubah status lifecycle produk
 */
router.post('/product/:id/override-status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['NEW', 'TESTING', 'PROMISING', 'PROVEN', 'SCALING', 'COOLING', 'STOPPED'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Status lifecycle tidak valid.' });
    }

    const docRef = db.collection('affiliate_products').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Produk tidak ditemukan.' });
    }

    await docRef.update({
      lifecycle_status: status,
      'quarterly_status.status': status === 'STOPPED' ? 'stopped_for_quarter' : 'active',
      updated_at: new Date().toISOString()
    });

    res.json({ success: true, message: `Status berhasil diubah menjadi ${status}` });
  } catch (err) {
    console.error('[POST /agent/product/:id/override-status Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/agent/config & POST /api/agent/config
 */
router.get('/config', async (req, res) => {
  try {
    const config = await getAgentConfig(req.user.id);
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/config', async (req, res) => {
  try {
    await updateAgentConfig(req.user.id, req.body || {});
    const config = await getAgentConfig(req.user.id);
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
