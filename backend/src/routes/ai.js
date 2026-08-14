const express = require('express');
const { authRequired } = require('../middleware/auth');
const { generateCaption } = require('../services/aiService');
const router = express.Router();

router.use(authRequired);

const handleGenerate = async (req, res) => {
  const topic = req.body.prompt || req.body.topic;
  const { tone, platform, length } = req.body || {};

  if (!topic || !String(topic).trim()) {
    return res.status(400).json({ error: 'Topik / deskripsi konten wajib diisi.' });
  }

  try {
    const caption = await generateCaption({ topic: String(topic), tone, platform, length });
    const cleanTopic = String(topic).trim();
    const title = cleanTopic.length > 40 ? cleanTopic.slice(0, 40) + '...' : cleanTopic;

    res.json({
      content: caption,
      caption: caption,
      title: title,
    });
  } catch (e) {
    const message = e?.response?.data?.message || e.message;
    res.status(500).json({ error: `Gagal generate caption: ${message}` });
  }
};

// POST /api/ai/generate
router.post('/generate', handleGenerate);

// POST /api/ai/generate-caption
router.post('/generate-caption', handleGenerate);

module.exports = router;

