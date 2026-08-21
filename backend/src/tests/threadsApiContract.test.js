const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { db } = require('../config/firebase');
const { get } = require('../services/threads/api/threadsApiClient');
const { getPublishingLimit } = require('../services/threads/api/threadsQuotaApi');
const { getReplies } = require('../services/threads/api/threadsReplyApi');
const { searchPosts } = require('../services/threads/api/threadsSearchApi');

async function runContractTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING THREADS API CONTRACT TESTS (Meta v1.0)');
  console.log('====================================================\n');

  try {
    // 1. Ambil salah satu akun Threads aktif dari DB
    const accountsSnap = await db.collection('social_accounts')
      .where('platform', '==', 'threads')
      .where('is_active', 'in', [1, true, '1'])
      .limit(1)
      .get();

    if (accountsSnap.empty) {
      console.warn('⚠️ Tidak ada akun Threads aktif di database. Melewati live API test.');
      return;
    }

    const acc = accountsSnap.docs[0].data();
    const token = acc.access_token;
    const userId = acc.page_id;
    console.log(`📌 Menguji akun: @${acc.page_name} (ID: ${userId})`);

    // Test 1: User Profile & Identity (/me)
    try {
      console.log('\n[1/5] Menguji GET /me ...');
      const profile = await get('me', token, { fields: 'id,username,threads_profile_picture_url' });
      console.log('  ✅ SUCCESS: Profile verified:', profile.username, `(ID: ${profile.id})`);
    } catch (e) {
      console.error('  ❌ FAILED GET /me:', e.message);
    }

    // Test 2: Publishing & Reply Limit (/me/threads_publishing_limit)
    try {
      console.log('\n[2/5] Menguji GET /me/threads_publishing_limit ...');
      const limits = await getPublishingLimit('me', token);
      console.log('  ✅ SUCCESS: Quota Verified ->', {
        postQuota: `${limits.postQuotaUsage}/${limits.postQuotaTotal}`,
        replyQuota: `${limits.replyQuotaUsage}/${limits.replyQuotaTotal}`,
      });
    } catch (e) {
      console.error('  ❌ FAILED Quota limit check:', e.message);
    }

    // Test 3: Fetch Owned Posts (/me/threads)
    let firstPostId = null;
    try {
      console.log('\n[3/5] Menguji GET /me/threads ...');
      const postsRes = await get('me/threads', token, { fields: 'id,text,timestamp', limit: 5 });
      const posts = postsRes.data || [];
      console.log(`  ✅ SUCCESS: Retrieved ${posts.length} owned threads.`);
      if (posts.length > 0) {
        firstPostId = posts[0].id;
        console.log(`  🔍 Sample Post ID: ${firstPostId}`);
      }
    } catch (e) {
      console.error('  ❌ FAILED GET /me/threads:', e.message);
    }

    // Test 4: Fetch Replies on Owned Post (/{thread_id}/replies)
    if (firstPostId) {
      try {
        console.log(`\n[4/5] Menguji GET /${firstPostId}/replies ...`);
        const repliesRes = await getReplies(firstPostId, token, { limit: 5 });
        const replies = repliesRes.data || [];
        console.log(`  ✅ SUCCESS: Retrieved ${replies.length} replies on thread #${firstPostId}`);
      } catch (e) {
        console.error('  ❌ FAILED GET replies:', e.message);
      }
    } else {
      console.log('\n[4/5] GET replies dilewati (belum ada postingan terbit untuk diuji).');
    }

    // Test 5: Keyword Search (/keyword_search)
    try {
      console.log('\n[5/5] Menguji GET /keyword_search (q="rekomendasi") ...');
      const searchRes = await searchPosts(token, 'rekomendasi', { limit: 3 });
      const results = searchRes.data || [];
      console.log(`  ✅ SUCCESS: Keyword search returned ${results.length} posts.`);
    } catch (e) {
      console.log('  ℹ️ Info Keyword Search:', e.message);
    }

    console.log('\n====================================================');
    console.log('🎉 CONTRACT TESTS COMPLETED');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Contract test runner error:', err.message);
  }
}

if (require.main === module) {
  runContractTests().then(() => process.exit(0));
}

module.exports = { runContractTests };
