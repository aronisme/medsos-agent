const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { db } = require('../config/firebase');
const { get } = require('../services/threads/api/threadsApiClient');

async function testLiveKeywordSearch() {
  console.log('====================================================');
  console.log('🔍 LIVE THREADS KEYWORD SEARCH DIAGNOSTIC');
  console.log('====================================================\n');

  try {
    const accountsSnap = await db.collection('social_accounts')
      .where('platform', '==', 'threads')
      .where('is_active', 'in', [1, true, '1'])
      .get();

    if (accountsSnap.empty) {
      console.warn('⚠️ Tidak ada akun Threads aktif di database.');
      return;
    }

    const acc = accountsSnap.docs[0].data();
    const token = acc.access_token;
    console.log(`Menguji dengan token akun: @${acc.page_name} (ID: ${acc.page_id})\n`);

    const queries = ['shopee', 'fashion', 'outfit', 'baju', 'jakarta', 'threads'];

    for (const q of queries) {
      try {
        console.log(`📡 Mencari: "${q}" (search_type: RECENT) ...`);
        const resRecent = await get('keyword_search', token, {
          q,
          search_type: 'RECENT',
          fields: 'id,text,permalink,timestamp,username',
          limit: 5,
        });

        const recentItems = resRecent.data || [];
        console.log(`  -> Hasil RECENT: ${recentItems.length} postingan ditemukan.`);
        if (recentItems.length > 0) {
          console.log(`     Sample post by @${recentItems[0].username}: "${recentItems[0].text?.slice(0, 60)}..."`);
        }

        // Test search_type: TOP
        const resTop = await get('keyword_search', token, {
          q,
          search_type: 'TOP',
          fields: 'id,text,permalink,timestamp,username',
          limit: 5,
        });
        const topItems = resTop.data || [];
        console.log(`  -> Hasil TOP: ${topItems.length} postingan ditemukan.\n`);
      } catch (err) {
        console.error(`  ❌ Error mencari "${q}":`, err.message);
      }
    }

    console.log('====================================================');
    console.log('🎉 DIAGNOSTIC SELESAI');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Fatal error:', err.message);
  }
}

testLiveKeywordSearch().then(() => process.exit(0));
