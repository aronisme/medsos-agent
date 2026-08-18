/**
 * Script untuk mencari semua data di Firestore yang mengandung medsos-agent.vercel.app
 */
require('dotenv').config();
const { db } = require('./config/firebase');

async function checkFirestoreForOldDomain() {
  console.log('=== 🔍 MENCARI DOMAIN LAMA DI SELURUH KOLEKSI FIRESTORE ===\n');

  try {
    const collections = ['posts', 'templates', 'post_templates', 'short_links', 'agent_config'];

    for (const col of collections) {
      const snap = await db.collection(col).get();
      let foundCount = 0;
      
      for (const doc of snap.docs) {
        const str = JSON.stringify(doc.data());
        if (str.includes('medsos-agent.vercel.app') || str.includes('medsos-agent')) {
          console.log(`[Ditemukan di ${col}] Doc ID: ${doc.id}`);
          foundCount++;

          // Perbaiki langsung jika itu template atau post
          const updatedStr = str.replace(/medsos-agent\.vercel\.app/g, 'shopee-link-aff.vercel.app');
          await db.collection(col).doc(doc.id).set(JSON.parse(updatedStr));
          console.log(`  -> Berhasil diperbarui ke shopee-link-aff.vercel.app`);
        }
      }
      console.log(`Koleksi ${col}: ${foundCount} dokumen diperbaiki.`);
    }

    console.log('\n=== 🎉 PEMERIKSAAN & PERBAIKAN FIRESTORE SELESAI ===');
  } catch (err) {
    console.error('Error:', err);
  }
}

checkFirestoreForOldDomain();
