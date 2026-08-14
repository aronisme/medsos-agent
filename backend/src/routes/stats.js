const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

// GET /api/stats — statistik dashboard
router.get('/', (req, res) => {
  const uid = req.user.id;

  const counts = db
    .prepare(`SELECT status, COUNT(*) AS total FROM posts WHERE user_id = ? GROUP BY status`)
    .all(uid);

  const byPlatform = db
    .prepare(
      `SELECT t.platform, COUNT(*) AS total,
              SUM(CASE WHEN t.status = 'success' THEN 1 ELSE 0 END) AS success
       FROM post_targets t
       JOIN posts p ON p.id = t.post_id AND p.user_id = ?
       GROUP BY t.platform`
    )
    .all(uid);

  const recent = db
    .prepare(
      `SELECT p.*, COUNT(t.id) AS target_count,
              SUM(CASE WHEN t.status = 'success' THEN 1 ELSE 0 END) AS success_count
       FROM posts p
       LEFT JOIN post_targets t ON t.post_id = p.id
       WHERE p.user_id = ?
       GROUP BY p.id
       ORDER BY p.created_at DESC LIMIT 8`
    )
    .all(uid);

  const recentLogs = db
    .prepare(`SELECT * FROM logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`)
    .all(uid);

  const summary = { draft: 0, scheduled: 0, posted: 0, failed: 0 };
  for (const c of counts) summary[c.status] = c.total;

  res.json({ summary, byPlatform, recent, recentLogs });
});

module.exports = router;
