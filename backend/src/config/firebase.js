const { mongoDb, FieldValue: MongoFieldValue, isMongoConfigured } = require('./mongo');

let db;
let FieldValue;

// Smart Dual-Engine: Gunakan MongoDB Atlas jika MONGODB_URI tersedia di Vercel / .env
if (isMongoConfigured()) {
  console.log('[Database Engine] 🍃 Menggunakan MongoDB Atlas (Unlimited Free Cluster)');
  db = mongoDb;
  FieldValue = MongoFieldValue;
} else {
  // Fallback: Gunakan Firebase Firestore
  console.log('[Database Engine] 🔥 Menggunakan Firebase Firestore');
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  const { getFirestore, FieldValue: FirebaseFieldValue } = require('firebase-admin/firestore');
  const path = require('path');
  const fs = require('fs');

  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const buff = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64');
    serviceAccount = JSON.parse(buff.toString('utf-8'));
  } else {
    const localKeyPath = path.resolve(__dirname, '..', '..', 'serviceAccountKey.json');
    if (fs.existsSync(localKeyPath)) {
      serviceAccount = require(localKeyPath);
    } else {
      console.warn('FIREBASE_SERVICE_ACCOUNT_BASE64 atau serviceAccountKey.json tidak ditemukan.');
    }
  }

  let app;
  if (getApps().length === 0 && serviceAccount) {
    app = initializeApp({
      credential: cert(serviceAccount)
    });
  } else if (getApps().length > 0) {
    app = getApps()[0];
  }

  db = getFirestore();
  FieldValue = FirebaseFieldValue;
}

module.exports = { db, FieldValue };
