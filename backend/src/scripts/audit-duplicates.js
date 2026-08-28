const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { db } = require('../config/firebase');

async function findDuplicates() {
  console.log('[Database] Mengambil seluruh postingan...');
  const snap = await db.collection('posts').get();
  const postsByAccount = {};
  
  snap.forEach(doc => {
    const d = { id: doc.id, ...doc.data() };
    const targets = d.targets || [];
    targets.forEach(t => {
      const accKey = t.account_id || t.page_name || 'unknown';
      if (!postsByAccount[accKey]) postsByAccount[accKey] = [];
      postsByAccount[accKey].push({
        postId: d.id,
        title: d.title,
        productId: d.product_id,
        content: d.content,
        status: d.status,
        targetStatus: t.status,
        platform: t.platform,
        pageName: t.page_name,
        scheduledAt: d.scheduled_at,
        createdAt: d.created_at,
        postedAt: d.posted_at,
        postOnPlatformId: t.post_id_on_platform
      });
    });
  });

  console.log('\n================ AUDIT DUPLIKASI PER AKUN ================');
  for (const [accKey, postList] of Object.entries(postsByAccount)) {
    const contentMap = {};
    const productMap = {};

    postList.forEach(p => {
      const textKey = (p.content || '').trim().replace(/\s+/g, ' ').slice(0, 100);
      contentMap[textKey] = contentMap[textKey] || [];
      contentMap[textKey].push(p);

      if (p.productId) {
        productMap[p.productId] = productMap[p.productId] || [];
        productMap[p.productId].push(p);
      }
    });

    const duplicateTexts = Object.entries(contentMap).filter(([k, v]) => v.length > 1);
    const duplicateProds = Object.entries(productMap).filter(([k, v]) => v.length > 1);

    const accName = postList[0]?.pageName || accKey;
    const platform = postList[0]?.platform || 'unknown';

    console.log(`\nAkun: ${accName} | Platform: ${platform} (Total Posts: ${postList.length})`);
    console.log(` - Postingan dengan Teks/Caption Identik Persis: ${duplicateTexts.length}`);
    console.log(` - Produk yang Diposting Lebih Dari 1 Kali: ${duplicateProds.length}`);

    if (duplicateTexts.length > 0) {
      console.log('   Sample Postingan Identik:');
      duplicateTexts.slice(0, 3).forEach(([txt, list], idx) => {
        console.log(`   [Duplikat #${idx + 1}] (${list.length}x sama): "${txt.slice(0, 60)}..."`);
        list.forEach(item => {
          console.log(`      -> ID: ${item.postId} | Scheduled: ${item.scheduledAt} | Created: ${item.createdAt} | Status: ${item.status} (Target: ${item.targetStatus}) | PlatformID: ${item.postOnPlatformId || 'none'}`);
        });
      });
    }
  }

  console.log('\n==========================================================');
  process.exit(0);
}

findDuplicates().catch(err => {
  console.error(err);
  process.exit(1);
});
