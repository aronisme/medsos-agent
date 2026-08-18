const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
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
    console.error('FIREBASE_SERVICE_ACCOUNT_BASE64 atau serviceAccountKey.json tidak ditemukan!');
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

const db = getFirestore();

module.exports = { db, FieldValue };
