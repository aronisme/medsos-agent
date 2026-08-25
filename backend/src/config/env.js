const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dbPath: process.env.DB_PATH || './data/fb_ig_poster.db',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  mistralApiKey: process.env.MISTRAL_API_KEY || '',
  mistralModel: process.env.MISTRAL_MODEL || 'mistral-small-latest',
  groqApiKeys: (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '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,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,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')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean),
  groqModelPrimary: process.env.GROQ_MODEL_PRIMARY || 'openai/gpt-oss-120b',
  groqModelFast: process.env.GROQ_MODEL_FAST || 'openai/gpt-oss-20b',
  xkiroApiKey: process.env.XKIRO_API_KEY || '',
  xkiroBaseUrl: process.env.XKIRO_BASE_URL || 'https://api.xkiro.com/v1',
  xkiroModel: process.env.XKIRO_MODEL || 'ox-alpha',
  fbAppId: process.env.FB_APP_ID || '',
  fbAppSecret: process.env.FB_APP_SECRET || '',
  baseUrl: (process.env.BASE_URL || process.env.PUBLIC_URL || 'https://shopee-link-aff.vercel.app').replace(/medsos-agent\.vercel\.app/g, 'shopee-link-aff.vercel.app'),
  dryRun: (process.env.DRY_RUN || 'true').toLowerCase() !== 'false',
  mongodbUri: process.env.MONGODB_URI || process.env.MONGO_URL || '',
};

module.exports = env;
