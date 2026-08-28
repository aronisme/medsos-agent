/**
 * Script: Publish all today's scheduled and remaining failed posts
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { db } = require('../config/firebase');
const { publishPostNow } = require('../services/postService');

async function repostToday() {
  console.log('=== Reposting Today Posts ===');
  const snap = await db.collection('posts').get();
  const todayStr = '2026-08-28';
  const candidates = [];

  snap.forEach(doc => {
    const d = { id: doc.id, ...doc.data() };
    const dateStr = (d.scheduled_at || d.created_at || '').slice(0, 10);
    // Candidates are posts scheduled for today or created today with status 'scheduled' or 'failed'
    if (dateStr === todayStr && (d.status === 'scheduled' || d.status === 'failed')) {
      candidates.push(d);
    }
  });

  console.log(`Found ${candidates.length} posts for today to process/publish.`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    const post = candidates[i];
    console.log(`\n[${i + 1}/${candidates.length}] Publishing Post #${post.id.slice(0, 8)} (${post.title?.slice(0, 30)}...)...`);
    try {
      const res = await publishPostNow(post.id);
      console.log(`✅ Success! Results:`, JSON.stringify(res));
      successCount++;
    } catch (err) {
      console.error(`❌ Failed:`, err.message);
      failCount++;
    }
    // Small delay to be polite to Meta rate limits
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n======================================');
  console.log(`🎉 Summary: ${successCount} Published Successfully, ${failCount} Failed.`);
  console.log('======================================\n');
  process.exit(0);
}

repostToday().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
