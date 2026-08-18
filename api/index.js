let app;
let initError = null;

try {
  app = require('../backend/src/app');
} catch (e) {
  initError = {
    message: e.message,
    stack: e.stack
  };
  console.error('Failed to initialize app in api/index.js:', e);
}

module.exports = (req, res) => {
  if (initError) {
    return res.status(500).json({
      error: 'Backend Initialization Error on Vercel',
      details: initError
    });
  }
  return app(req, res);
};
