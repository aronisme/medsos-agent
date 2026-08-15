const express = require('express');
const { db } = require('../config/firebase');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

// GET /api/stats – statistik dashboard
router.get('/', async (req, res) => {
  try {
    const uid = req.user.id;

    // Ambil semua post user ini (in-memory sort agar tidak memicu Firestore Composite Index error)
    const postsSnap = await db.collection('posts')
      .where('user_id', '==', uid)
      .get();

    const summary = { draft: 0, scheduled: 0, posted: 0, failed: 0 };
    const platformStats = {};
    
    const allPosts = postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    allPosts.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

    allPosts.forEach((p) => {
      // Hitung summary status
      if (summary[p.status] !== undefined) summary[p.status]++;
      
      // Hitung target stats by platform
      const targets = p.targets || [];
      targets.forEach(t => {
        if (!platformStats[t.platform]) platformStats[t.platform] = { platform: t.platform, total: 0, success: 0 };
        platformStats[t.platform].total++;
        if (t.status === 'success') {
          platformStats[t.platform].success++;
        }
      });
    });

    const recent = allPosts.slice(0, 8).map(p => {
      const targets = p.targets || [];
      const successCount = targets.filter(t => t.status === 'success').length;
      return {
        ...p,
        target_count: targets.length,
        success_count: successCount
      };
    });

    const byPlatform = Object.values(platformStats);

    // Ambil logs user ini
    let recentLogs = [];
    try {
      const logsSnap = await db.collection('logs')
        .where('user_id', '==', uid)
        .get();
      const allLogs = logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      allLogs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      recentLogs = allLogs.slice(0, 10);
    } catch (e) {
      console.warn('Gagal membaca logs:', e.message);
    }

    // Ambil akun sosial aktif (fleksibel: is_active bisa integer 1, boolean true, atau string '1')
    const accSnap = await db.collection('social_accounts')
      .where('user_id', '==', uid)
      .get();

    const activeAccounts = accSnap.docs.filter(doc => {
      const d = doc.data();
      return d.is_active === 1 || d.is_active === true || d.is_active === '1';
    }).length;

    res.json({ 
      summary, 
      byPlatform, 
      recent, 
      recentLogs,
      activeAccounts
    });
  } catch (err) {
    console.error('Error stats endpoint:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

