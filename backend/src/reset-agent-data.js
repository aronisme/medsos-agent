/**
 * Script Reset Data Kerja Agent (Fresh Start)
 * Membersihkan riwayat memori, keputusan, eksperimen, dan postingan terjadwal agent
 * Mengembalikan seluruh status produk affiliate ke status "NEW" (Stok Baru)
 */
require('dotenv').config();
const { db } = require('./config/firebase');

async function deleteCollection(collectionName, batchSize = 100) {
  const collectionRef = db.collection(collectionName);
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

async function resetAgentWork() {
  console.log('=== 🧹 MEMULAI PROSES RESET DATA KERJA AGENT (FRESH START) ===\n');

  try {
    // 1. Hapus Memory Postingan Produk (product_post_memory)
    console.log('1. Membersihkan koleksi product_post_memory...');
    await deleteCollection('product_post_memory');
    console.log('   ✓ product_post_memory bersih.');

    // 2. Hapus Log Keputusan Agent (agent_decisions_log)
    console.log('2. Membersihkan koleksi agent_decisions_log...');
    await deleteCollection('agent_decisions_log');
    console.log('   ✓ agent_decisions_log bersih.');

    // 3. Hapus Eksperimen A/B (experiments)
    console.log('3. Membersihkan koleksi experiments...');
    await deleteCollection('experiments');
    console.log('   ✓ experiments bersih.');

    // 4. Hapus Wawasan Learning Layer (knowledge_insights)
    console.log('4. Membersihkan koleksi knowledge_insights...');
    await deleteCollection('knowledge_insights');
    console.log('   ✓ knowledge_insights bersih.');

    // 5. Hapus Postingan Terjadwal / Draf Otomatis (posts)
    console.log('5. Membersihkan postingan terjadwal otomatis di koleksi posts...');
    const postsSnap = await db.collection('posts').get();
    let deletedPostsCount = 0;
    const postBatch = db.batch();
    postsSnap.docs.forEach((doc) => {
      postBatch.delete(doc.ref);
      deletedPostsCount++;
    });
    if (deletedPostsCount > 0) {
      await postBatch.commit();
    }
    console.log(`   ✓ Menghapus ${deletedPostsCount} postingan dari antrean.`);

    // 6. Reset Status Seluruh Produk di affiliate_products menjadi "NEW"
    console.log('6. Mengembalikan status seluruh produk affiliate menjadi "NEW" (Stok Baru)...');
    const productsSnap = await db.collection('affiliate_products').get();
    let resetProductsCount = 0;
    const productBatch = db.batch();

    productsSnap.docs.forEach((doc) => {
      productBatch.update(doc.ref, {
        lifecycle_status: 'NEW',
        quarterly_status: { status: 'testing' },
        quarterly_summary: {
          total_attempts: 0,
          total_views: 0,
          total_clicks: 0,
          total_likes: 0,
          total_comments: 0,
          avg_ctr: '0.00',
          current_quarter: '2026-Q3'
        },
        updated_at: new Date().toISOString()
      });
      resetProductsCount++;
    });

    if (resetProductsCount > 0) {
      await productBatch.commit();
    }
    console.log(`   ✓ Berhasil mereset ${resetProductsCount} produk affiliate kembali ke status Stok Baru (NEW) dengan 0 riwayat.`);

    console.log('\n=== 🎉 RESET SELESAI: SISTEM AGENT SIAP DIMULAI DARI AWAL (FRESH SLATE) ===');

  } catch (err) {
    console.error('Error saat reset data:', err);
  }
}

resetAgentWork();
