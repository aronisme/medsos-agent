/**
 * CLI Tool: Repair & Rehost Failed Media Posts
 * 
 * Usage:
 *   node backend/src/scripts/repair-failed-posts.js [--dry-run] [--batch=10] [--limit=150]
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { db } = require('../config/firebase');
const { ensureMediaArrayReady, isMediaRelatedFailure } = require('../services/mediaRehostService');

async function repairFailedPosts() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const batchArg = args.find(a => a.startsWith('--batch='));
  
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 200;
  const batchSize = batchArg ? parseInt(batchArg.split('=')[1], 10) : 10;

  console.log(`\n==================================================`);
  console.log(`🛠️  MEDSOS AGENT - REPAIR FAILED MEDIA POSTS TOOL`);
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (Simulation Only)' : '🚀 LIVE REPAIR'}`);
  console.log(`Batch Size: ${batchSize} | Limit: ${limit}`);
  console.log(`==================================================\n`);

  // 1. Query all posts with status == 'failed'
  console.log('Querying failed posts from database...');
  const failedSnap = await db.collection('posts')
    .where('status', '==', 'failed')
    .limit(limit)
    .get();

  console.log(`Found ${failedSnap.docs.length} posts with status 'failed'.\n`);

  const candidates = [];
  const nonMediaFailures = [];

  for (const doc of failedSnap.docs) {
    const data = { id: doc.id, ...doc.data() };
    const hasShopeeMedia = (data.media || []).some(m => {
      const u = typeof m === 'string' ? m : (m.media_url || m.url || '');
      return u.includes('susercontent.com') || u.includes('shopee.co.id');
    });
    const mediaFailure = isMediaRelatedFailure(data);

    if (hasShopeeMedia || mediaFailure) {
      candidates.push(data);
    } else {
      nonMediaFailures.push(data);
    }
  }

  console.log(`📊 Classification Results:`);
  console.log(` - Media-Related Candidates (Eligible for Repair): ${candidates.length}`);
  console.log(` - Non-Media Failures (Auth/Permission/Other - Skipped): ${nonMediaFailures.length}\n`);

  if (candidates.length === 0) {
    console.log('✅ No media-related failed posts found to repair. Exiting.');
    process.exit(0);
  }

  if (isDryRun) {
    console.log('=== DRY RUN CANDIDATES PREVIEW (First 5) ===');
    candidates.slice(0, 5).forEach((p, idx) => {
      console.log(`\n[Candidate #${idx + 1}] ID: #${p.id}`);
      console.log(`Title: ${p.title}`);
      console.log(`Current Media:`, JSON.stringify(p.media));
      console.log(`Targets:`, JSON.stringify(p.targets));
    });
    console.log(`\n🔍 Dry run completed. To execute live repair, run without --dry-run`);
    process.exit(0);
  }

  // 2. Execute Live Repair in Controlled Batches
  let totalRepaired = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (let b = 0; b < candidates.length; b += batchSize) {
    const chunk = candidates.slice(b, b + batchSize);
    console.log(`\n--- Processing Batch ${Math.floor(b / batchSize) + 1} (${chunk.length} posts) ---`);

    for (const post of chunk) {
      const docRef = db.collection('posts').doc(post.id);
      try {
        // Step A: Resolve & Rehost Media
        const mediaRes = await ensureMediaArrayReady(post.media || [], { concurrency: 2 });
        
        // Step B: Target Status Safety - Only reset FAILED targets that are media-related
        let targetsUpdated = false;
        const updatedTargets = (post.targets || []).map(t => {
          if (t.status === 'failed') {
            targetsUpdated = true;
            return {
              ...t,
              status: 'pending',
              error_message: null,
              attempt_count: 0
            };
          }
          // Preserve already successful targets!
          return t;
        });

        // Step C: Update Firestore document
        const updatePayload = {
          media: mediaRes.media,
          targets: updatedTargets,
          status: 'scheduled',
          updated_at: new Date().toISOString(),
          repaired_at: new Date().toISOString()
        };

        // If first reply failed due to media, reset it too
        if (post.first_reply && post.first_reply.status === 'failed') {
          updatePayload['first_reply.status'] = 'pending';
          updatePayload['first_reply.reply_last_error'] = null;
        }

        await docRef.update(updatePayload);
        totalRepaired++;
        console.log(`✅ [#${post.id.slice(0, 8)}] Repaired & Rehosted ${mediaRes.media.length} media items. Status set to 'scheduled'.`);
      } catch (postErr) {
        totalErrors++;
        console.error(`❌ [#${post.id.slice(0, 8)}] Error during repair:`, postErr.message);
      }
    }
  }

  console.log(`\n==================================================`);
  console.log(`🎉 REPAIR COMPLETE SUMMARY:`);
  console.log(` - Total Repaired & Rehosted: ${totalRepaired}`);
  console.log(` - Total Errors: ${totalErrors}`);
  console.log(` - Total Non-Media Skipped: ${nonMediaFailures.length}`);
  console.log(`==================================================\n`);

  process.exit(0);
}

repairFailedPosts().catch(err => {
  console.error('Fatal error in repair script:', err);
  process.exit(1);
});
