/**
 * Script Migrasi Otomatis Seluruh Data dari Firebase Firestore ke MongoDB Atlas
 */
require('dotenv').config({ path: './.env' });
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getDb } = require('./config/mongo');
const path = require('path');
const fs = require('fs');

async function migrateData() {
  console.log('=== 🚀 MEMULAI MIGRASI DATA DARI FIRESTORE KE MONGODB ATLAS ===\n');

  // 1. Cek Koneksi MongoDB
  if (!process.env.MONGODB_URI && !process.env.MONGO_URL) {
    console.error('❌ Error: MONGODB_URI belum diisi di file .env.');
    console.log('Silakan masukkan MONGODB_URI dari Vercel/MongoDB Atlas ke backend/.env terlebih dahulu.');
    process.exit(1);
  }

  const mongoDb = await getDb();
  console.log('1. ✅ Terhubung ke MongoDB Atlas:', mongoDb.databaseName);

  // 2. Inisialisasi Firebase Admin
  let serviceAccount;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const buff = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64');
    serviceAccount = JSON.parse(buff.toString('utf-8'));
  } else {
    const localKeyPath = path.resolve(__dirname, '..', 'serviceAccountKey.json');
    if (fs.existsSync(localKeyPath)) {
      serviceAccount = require(localKeyPath);
    }
  }

  let firestoreApp;
  if (getApps().length === 0 && serviceAccount) {
    firestoreApp = initializeApp({ credential: cert(serviceAccount) }, 'firestore_migration');
  } else {
    firestoreApp = getApps()[0];
  }

  const firestoreDb = getFirestore(firestoreApp);
  console.log('2. ✅ Terhubung ke Firebase Firestore.');

  // Daftar koleksi yang akan dimigrasikan
  const collectionsToMigrate = [
    'users',
    'social_accounts',
    'affiliate_products',
    'posts',
    'short_links',
    'link_clicks',
    'product_post_memory',
    'post_analytics',
    'post_analytics_snapshots',
    'post_templates',
    'experiments',
    'knowledge_insights',
    'agent_config',
    'agent_decisions',
    'logs',
    'system_state'
  ];

  console.log(`\n3. Memulai transfer ${collectionsToMigrate.length} collections ke MongoDB...\n`);

  let totalMigratedDocs = 0;

  for (const colName of collectionsToMigrate) {
    try {
      const snap = await firestoreDb.collection(colName).get();
      if (snap.empty) {
        console.log(`   - [${colName}]: Kosong (0 dokumen)`);
        continue;
      }

      const docs = snap.docs.map(d => {
        const data = d.data();
        return {
          _id: d.id,
          ...data
        };
      });

      const bulkOps = docs.map(doc => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true
        }
      }));

      await mongoDb.collection(colName).bulkWrite(bulkOps);
      console.log(`   - [${colName}]: ✅ Berhasil menyalin ${docs.length} dokumen.`);
      totalMigratedDocs += docs.length;

    } catch (err) {
      if (err.message && err.message.includes('Quota exceeded')) {
        console.warn(`   - [${colName}]: ⚠️ Kuota Firestore habis hari ini. Dokumen akan tersalin otomatis saat kuota reset (14:00 WIB).`);
      } else {
        console.error(`   - [${colName}]: ❌ Error:`, err.message);
      }
    }
  }

  console.log(`\n=== 🎉 SELESAI! TOTAL ${totalMigratedDocs} DOKUMEN BERHASIL DISALIN KE MONGODB ATLAS! ===\n`);
  process.exit(0);
}

migrateData();
