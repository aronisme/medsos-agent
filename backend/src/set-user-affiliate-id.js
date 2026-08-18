/**
 * Script untuk Menyimpan Shopee Affiliate ID untuk user sr7aron@gmail.com
 */
require('dotenv').config();
const { db } = require('./config/firebase');

async function setUserShopeeAffiliateId() {
  console.log('=== 🛠️ MENYIMPAN SHOPEE AFFILIATE ID UNTUK USER sr7aron@gmail.com ===\n');

  try {
    const targetEmail = 'sr7aron@gmail.com';
    const affiliateId = '11328861338';

    // 1. Cari user di koleksi users
    const usersSnap = await db.collection('users').get();
    let updatedUsers = 0;

    for (const doc of usersSnap.docs) {
      const data = doc.data();
      if (data.email === targetEmail || doc.id === targetEmail) {
        await db.collection('users').doc(doc.id).set({
          shopee_affiliate_id: affiliateId,
          updated_at: new Date().toISOString()
        }, { merge: true });
        console.log(`✅ Berhasil memperbarui dokumen users #${doc.id} (${data.email}) dengan Shopee Affiliate ID: ${affiliateId}`);
        updatedUsers++;
      }
    }

    // 2. Simpan juga ke agent_config untuk default & user ID
    await db.collection('agent_config').doc('system').set({
      shopee_affiliate_id: affiliateId,
      updated_at: new Date().toISOString()
    }, { merge: true });

    // Jika ada ID user khusus, simpan juga
    for (const doc of usersSnap.docs) {
      const data = doc.data();
      if (data.email === targetEmail) {
        await db.collection('agent_config').doc(doc.id).set({
          shopee_affiliate_id: affiliateId,
          updated_at: new Date().toISOString()
        }, { merge: true });
      }
    }

    console.log(`\n🎉 Shopee Affiliate ID "${affiliateId}" telah resmi terkunci dan tersimpan di database Firestore untuk akun ${targetEmail}.`);

  } catch (err) {
    console.error('Error saat menyimpan Affiliate ID:', err);
  }
}

setUserShopeeAffiliateId();
