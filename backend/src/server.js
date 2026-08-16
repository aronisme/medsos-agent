const app = require('./app');
const env = require('./config/env');

if (process.env.NODE_ENV !== 'production') {
  app.listen(env.port, () => {
    console.log(`🚀 Backend jalan di http://localhost:${env.port} (dry-run: ${env.dryRun})`);
    if (!env.dryRun && (!env.fbAppId || !env.fbAppSecret)) {
      console.warn('⚠️  DRY_RUN=false tapi FB_APP_ID/FB_APP_SECRET belum diisi di .env');
    }
  });
}

module.exports = app;
