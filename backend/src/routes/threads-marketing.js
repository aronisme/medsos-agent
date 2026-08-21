const express = require('express');
const { db } = require('../config/firebase');
const { authRequired } = require('../middleware/auth');
const { listCandidates, approveCandidate, rejectCandidate } = require('../services/threads/outbound/candidateService');
const { scanAndProcessInboundReplies } = require('../services/threads/inbound/inboundService');
const { runOutboundSocialListening } = require('../services/threads/outbound/outboundService');

const router = express.Router();
router.use(authRequired);

// ==========================================
// 1. CANDIDATES APPROVAL QUEUE ENDPOINTS
// ==========================================

// GET /api/threads-marketing/candidates
router.get('/candidates', async (req, res) => {
  try {
    const { status = 'ALL' } = req.query;
    const candidates = await listCandidates(req.user.id, status);
    res.json({ candidates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/threads-marketing/candidates/:id/approve
router.post('/candidates/:id/approve', async (req, res) => {
  try {
    const { customReplyText, publishMode = 'REPLY' } = req.body || {};
    const result = await approveCandidate(req.params.id, req.user.id, { customReplyText, publishMode });
    res.json({
      success: true,
      message: publishMode === 'QUOTE' ? 'Quote Post berhasil dipublikasikan ke Threads!' : 'Balasan berhasil dipublikasikan ke Threads!',
      ...result,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/threads-marketing/candidates/:id/reject
router.post('/candidates/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body || {};
    await rejectCandidate(req.params.id, req.user.id, reason);
    res.json({ success: true, message: 'Kandidat berhasil ditolak.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 2. KEYWORD SOCIAL LISTENING ENDPOINTS
// ==========================================

// GET /api/threads-marketing/keywords
router.get('/keywords', async (req, res) => {
  try {
    const snap = await db.collection('threads_monitoring_keywords')
      .where('user_id', '==', req.user.id)
      .get();
    const keywords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ keywords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/threads-marketing/keywords
router.post('/keywords', async (req, res) => {
  try {
    const { keyword, category = 'general', priority = 1 } = req.body || {};
    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ error: 'Kata kunci wajib diisi.' });
    }

    const newDoc = {
      user_id: req.user.id,
      keyword: keyword.trim().toLowerCase(),
      category: category.trim(),
      priority: Number(priority) || 1,
      is_active: true,
      created_at: new Date().toISOString(),
      last_searched_at: null,
    };

    const docRef = await db.collection('threads_monitoring_keywords').add(newDoc);
    res.status(201).json({ success: true, keyword: { id: docRef.id, ...newDoc } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/threads-marketing/keywords/:id
router.delete('/keywords/:id', async (req, res) => {
  try {
    const docRef = db.collection('threads_monitoring_keywords').doc(req.params.id);
    const doc = await docRef.get();
    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ error: 'Kata kunci tidak ditemukan.' });
    }

    await docRef.delete();
    res.json({ success: true, message: 'Kata kunci berhasil dihapus.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. INBOUND LOGS & MANUAL TRIGGER
// ==========================================

// GET /api/threads-marketing/inbound-logs
router.get('/inbound-logs', async (req, res) => {
  try {
    const snap = await db.collection('threads_auto_reply_logs')
      .where('user_id', '==', req.user.id)
      .get();
    const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    logs.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    res.json({ logs: logs.slice(0, 50) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/threads-marketing/trigger-scan
router.post('/trigger-scan', async (req, res) => {
  try {
    const { type = 'all' } = req.body || {};
    let inboundRes = null;
    let outboundRes = null;

    if (type === 'inbound' || type === 'all') {
      inboundRes = await scanAndProcessInboundReplies(req.user.id);
    }
    if (type === 'outbound' || type === 'all') {
      outboundRes = await runOutboundSocialListening(req.user.id);
    }

    res.json({
      success: true,
      message: 'Pemindaian berhasil dijalankan.',
      inbound: inboundRes,
      outbound: outboundRes,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
