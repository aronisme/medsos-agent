const express = require('express');
const cors = require('cors');
const path = require('path');
const env = require('./config/env');
const db = require('./db');

// Routes
const authRoutes = require('./routes/auth');
const oauthRoutes = require('./routes/auth-oauth');
const accountRoutes = require('./routes/accounts');
const postRoutes = require('./routes/posts');
const templateRoutes = require('./routes/templates');
const aiRoutes = require('./routes/ai');
const statsRoutes = require('./routes/stats');

// Scheduler
const { startScheduler } = require('./workers/scheduler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Static uploads removed since we use Cloudinary

// Health
app.get('/api/health', (req, res) => res.json({ ok: true, dryRun: env.dryRun, time: new Date().toISOString() }));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/auth', oauthRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/stats', statsRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan.' }));

// Error handler
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
});

app.listen(env.port, () => {
  console.log(`🚀 Backend jalan di http://localhost:${env.port} (dry-run: ${env.dryRun})`);
  if (!env.dryRun && (!env.fbAppId || !env.fbAppSecret)) {
    console.warn('⚠️  DRY_RUN=false tapi FB_APP_ID/FB_APP_SECRET belum diisi di .env');
  }
  startScheduler();
});
