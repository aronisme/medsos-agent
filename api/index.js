let app;
let initError = null;

function getApp() {
  if (app) return app;
  try {
    app = require('../backend/src/app');
    initError = null;
    return app;
  } catch (e) {
    initError = {
      message: e.message,
      stack: e.stack
    };
    console.error('Failed to initialize app in api/index.js:', e);
    throw e;
  }
}

module.exports = (req, res) => {
  try {
    const handler = getApp();
    return handler(req, res);
  } catch (err) {
    return res.status(500).json({
      error: 'Backend Initialization Error on Vercel',
      message: err.message,
      details: initError
    });
  }
};
