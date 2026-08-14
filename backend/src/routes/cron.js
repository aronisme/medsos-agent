const express = require('express');
const router = express.Router();
const { processScheduledPosts } = require('../workers/scheduler');

// GET /api/cron/publish
// Endpoint ini dipanggil oleh Google Apps Script atau Vercel Cron setiap menit
router.get('/publish', async (req, res) => {
  try {
    const results = await processScheduledPosts();
    res.status(200).json({ ok: true, message: 'Scheduler berhasil dijalankan', results });
  } catch (error) {
    console.error('[cron api error]', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
