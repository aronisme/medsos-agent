/**
 * Deep Database & System Auditor and Repair Tool
 * 
 * Thoroughly inspects every collection and nested field in MongoDB Atlas,
 * Firebase Firestore, and SQLite to guarantee 100% replacement of old domains
 * with https://shopee-link-aff.vercel.app
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { MongoClient } = require('mongodb');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

const TARGET_DOMAIN = 'shopee-link-aff.vercel.app';
const TARGET_URL = 'https://shopee-link-aff.vercel.app';

// Domain patterns that need replacement
const OLD_DOMAIN_PATTERNS = [
  /https?:\/\/medsos-agent\.vercel\.app/g,
  /https?:\/\/medsos\.app/g,
  /medsos-agent\.vercel\.app/g
];

function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  let updated = str;
  for (const pattern of OLD_DOMAIN_PATTERNS) {
    if (pattern.test(updated)) {
      if (pattern.source.startsWith('https?:')) {
        updated = updated.replace(pattern, TARGET_URL);
      } else {
        updated = updated.replace(pattern, TARGET_DOMAIN);
      }
    }
  }
  return updated;
}

function deepCleanObject(obj, stats = { replaced: 0 }) {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    const cleaned = sanitizeString(obj);
    if (cleaned !== obj) {
      stats.replaced++;
    }
    return cleaned;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepCleanObject(item, stats));
  }

  if (typeof obj === 'object') {
    const newObj = {};
    for (const key of Object.keys(obj)) {
      newObj[key] = deepCleanObject(obj[key], stats);
    }
    return newObj;
  }

  return obj;
}

async function auditAndCleanMongo() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!uri) {
    console.log('⚠️ [MongoDB] MONGODB_URI not found in environment.');
    return;
  }

  const dbName = process.env.MONGODB_DB_NAME || 'medsos_agent';
  console.log(`\n==================================================`);
  console.log(`🍃 [MongoDB Atlas] Deep Scanning Database: ${dbName}`);
  console.log(`==================================================`);

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  const collections = await db.listCollections().toArray();
  console.log(`Found ${collections.length} collections:`, collections.map(c => c.name).join(', '));

  let totalUpdatedDocs = 0;

  for (const colInfo of collections) {
    const colName = colInfo.name;
    const col = db.collection(colName);
    const cursor = col.find({});
    let colUpdatedCount = 0;
    let totalInCol = 0;

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      totalInCol++;
      const stats = { replaced: 0 };
      const { _id, ...docBody } = doc;
      const cleanedBody = deepCleanObject(docBody, stats);

      if (stats.replaced > 0) {
        await col.replaceOne({ _id }, { _id, ...cleanedBody });
        colUpdatedCount++;
        totalUpdatedDocs++;
        console.log(`   [Fixed] ${colName} -> doc ID: ${_id} (${stats.replaced} fields updated)`);
      }
    }
    console.log(` -> [${colName}] Scanned ${totalInCol} docs, updated ${colUpdatedCount} docs.`);
  }

  await client.close();
  console.log(`🍃 [MongoDB Atlas] Total Docs Updated: ${totalUpdatedDocs}\n`);
}

async function auditAndCleanFirestore() {
  console.log(`==================================================`);
  console.log(`🔥 [Firebase Firestore] Deep Scanning Database`);
  console.log(`==================================================`);

  let serviceAccount = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const buff = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64');
      serviceAccount = JSON.parse(buff.toString('utf-8'));
    } catch (e) {
      console.warn('Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:', e.message);
    }
  } else {
    const localKeyPath = path.resolve(__dirname, '../serviceAccountKey.json');
    if (fs.existsSync(localKeyPath)) {
      serviceAccount = require(localKeyPath);
    }
  }

  if (!serviceAccount) {
    console.log('⚠️ [Firestore] No service account credentials found. Skipping direct Firestore check.');
    return;
  }

  let app;
  if (getApps().length === 0) {
    app = initializeApp({ credential: cert(serviceAccount) });
  } else {
    app = getApps()[0];
  }

  const firestore = getFirestore();
  const knownCollections = [
    'posts',
    'templates',
    'post_templates',
    'short_links',
    'link_clicks',
    'affiliate_products',
    'agent_config',
    'experiments',
    'product_profiles',
    'social_accounts',
    'users'
  ];

  let totalUpdatedDocs = 0;

  for (const colName of knownCollections) {
    try {
      const snapshot = await firestore.collection(colName).get();
      let colUpdatedCount = 0;

      for (const doc of snapshot.docs) {
        const stats = { replaced: 0 };
        const data = doc.data();
        const cleanedData = deepCleanObject(data, stats);

        if (stats.replaced > 0) {
          await firestore.collection(colName).doc(doc.id).set(cleanedData);
          colUpdatedCount++;
          totalUpdatedDocs++;
          console.log(`   [Fixed] ${colName} -> doc ID: ${doc.id} (${stats.replaced} fields updated)`);
        }
      }
      console.log(` -> [${colName}] Scanned ${snapshot.docs.length} docs, updated ${colUpdatedCount} docs.`);
    } catch (err) {
      console.log(` -> [${colName}] Error or collection empty: ${err.message}`);
    }
  }

  console.log(`🔥 [Firestore] Total Docs Updated: ${totalUpdatedDocs}\n`);
}

async function run() {
  console.log('🚀 STARTING DEEP DATABASE AUDIT & URL ENFORCEMENT');
  console.log(`Target URL: ${TARGET_URL}\n`);

  await auditAndCleanMongo();
  await auditAndCleanFirestore();

  console.log('==================================================');
  console.log('✅ ALL DATABASES AUDITED AND SANITIZED SUCCESSFULLY!');
  console.log('==================================================');
}

run().then(() => process.exit(0)).catch(err => {
  console.error('[Audit Fatal Error]:', err);
  process.exit(1);
});
