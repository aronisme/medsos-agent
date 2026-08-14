const express = require('express');
const { db } = require('../config/firebase');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

// GET /api/stats � statistik dashboard
router.get('/', async (req, res) => {
  try {
    const uid = req.user.id;

    // Ambil semua post user ini (untuk statistik)
    const postsSnap = await db.collection('posts')
      .where('user_id', '==', uid)
      .orderBy('created_at', 'desc')
      .get();
      
    const summary = { draft: 0, scheduled: 0, posted: 0, failed: 0 };
    const platformStats = {};
    const recent = [];
    
    postsSnap.docs.forEach((doc, idx) => {
      const p = doc.data();
      // Hitung summary status
      if (summary[p.status] !== undefined) summary[p.status]++;
      
      // Hitung target stats by platform
      const targets = p.targets || [];
      let successCount = 0;
      
      targets.forEach(t => {
        if (!platformStats[t.platform]) platformStats[t.platform] = { platform: t.platform, total: 0, success: 0 };
        platformStats[t.platform].total++;
        if (t.status === 'success') {
          platformStats[t.platform].success++;
          successCount++;
        }
      });
      
      // Ambil 8 recent
      if (idx < 8) {
        recent.push({
          id: doc.id,
          ...p,
          target_count: targets.length,
          success_count: successCount
        });
      }
    });


    const byPlatform = Object.values(platformStats);

    const logsSnap = await db.collection('logs')
      .where('user_id', '==', uid)
      .orderBy('created_at', 'desc')
      .limit(10)
      .get();
      
    const recentLogs = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const accSnap = await db.collection('social_accounts')
      .where('user_id', '==', uid)
      .where('is_active', '==', true)
      .get();

    res.json({ 
      summary, 
      byPlatform, 
      recent, 
      recentLogs,
      activeAccounts: accSnap.size
    });
  } catch (err) {

    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
