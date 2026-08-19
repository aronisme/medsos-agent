/**
 * Script Rekonsiliasi & Backfill Data Analitik ke Memori Agent & Product Lifecycle
 */
require('dotenv').config({ path: './.env' });
const { db } = require('./config/firebase');
const { syncPostMemoryMetrics, updateProductQuarterlySnapshot, getCurrentQuarter } = require('./services/agent/productPostMemoryService');
const { recordTemplatePerformance } = require('./services/agent/templateService');
const { synthesizeKnowledge } = require('./services/agent/knowledgeSynthesizer');
const { matchAffiliateLinks } = require('./services/postAnalytics/linkMatcher');

async function runBackfill() {
  console.log('=== 🚀 MEMULAI BACKFILL & REKONSILIASI DATA ANALITIK KE MEMORI AGENT ===\n');

  try {
    const quarter = getCurrentQuarter();

    // 1. Ambil seluruh data post_analytics yang sudah tersimpan
    console.log('1. Mengambil data post_analytics dari Firestore...');
    const postAnalyticsSnap = await db.collection('post_analytics').get();
    console.log(`   Ditemukan ${postAnalyticsSnap.size} dokumen post_analytics.`);

    // 2. Ambil seluruh data short_links
    console.log('2. Mengambil data short_links dari Firestore...');
    const shortLinksSnap = await db.collection('short_links').get();
    const shortLinksMap = new Map();
    shortLinksSnap.forEach(d => {
      shortLinksMap.set(d.id, { id: d.id, ...d.data() });
    });
    console.log(`   Ditemukan ${shortLinksMap.size} dokumen short_links.`);

    // 3. Ambil data posts internal
    console.log('3. Mengambil data posts internal...');
    const postsSnap = await db.collection('posts').get();
    const platformPostMap = new Map();
    const postsList = [];
    postsSnap.forEach(d => {
      const p = { id: d.id, ...d.data() };
      postsList.push(p);
      if (Array.isArray(p.targets)) {
        p.targets.forEach(t => {
          if (t.post_id_on_platform) {
            platformPostMap.set(String(t.post_id_on_platform), p);
          }
        });
      }
    });
    console.log(`   Ditemukan ${postsList.length} dokumen posts.`);

    let syncedMemoryCount = 0;
    const affectedProductIds = new Set();
    const affectedUserIds = new Set();

    // 4. Proses Rekonsiliasi per Dokumen post_analytics
    console.log('\n4. Menghubungkan setiap post_analytics ke product_post_memory...');
    for (const doc of postAnalyticsSnap.docs) {
      const pData = doc.data();
      const userId = pData.user_id || 'system';
      affectedUserIds.add(userId);

      const rawPostId = pData.identity?.post_id || pData.id;
      const cleanPostId = String(rawPostId).replace(/[^a-zA-Z0-9_]/g, '_');
      const platform = pData.identity?.platform || 'facebook';

      // Cocokkan link di caption
      const affiliateData = await matchAffiliateLinks(pData.content?.caption || '', userId);
      const matchedPost = platformPostMap.get(String(rawPostId)) || null;

      let productId = affiliateData.short_links?.[0]?.product_id || matchedPost?.product_id || null;
      let shortlinkCode = affiliateData.short_links?.[0]?.code || '';

      // Jika belum ketemu product_id, cari via shortLinksMap
      if (!productId && shortlinkCode && shortLinksMap.has(shortlinkCode)) {
        productId = shortLinksMap.get(shortlinkCode).product_id;
      }

      const totalClicks = pData.affiliate?.human_clicks || pData.affiliate?.total_clicks || affiliateData.human_clicks || affiliateData.total_clicks || 0;
      const rawViews = Number(pData.metrics?.views) || Number(pData.metrics?.reach) || 0;

      const rawMetrics = {
        views: rawViews,
        reach: Number(pData.metrics?.reach) || rawViews,
        likes: Number(pData.metrics?.likes) || 0,
        comments: (Number(pData.metrics?.comments) || 0) + (Number(pData.metrics?.replies) || 0),
        shares: (Number(pData.metrics?.shares) || 0) + (Number(pData.metrics?.reposts) || 0) + (Number(pData.metrics?.quotes) || 0),
        saves: Number(pData.metrics?.saves) || 0,
        affiliate_clicks: totalClicks,
      };

      const targetPostId = matchedPost ? matchedPost.id : pData.id;

      const fallbackContext = {
        product_id: productId,
        user_id: userId,
        platform: platform,
        account_id: pData.identity?.account_id || '',
        account_name: pData.identity?.account_name || '',
        shortlink_code: shortlinkCode,
        published_at: pData.content?.published_at || new Date().toISOString(),
        posting_hour: new Date(pData.content?.published_at || Date.now()).getHours(),
        template_id: matchedPost?.template_id || 'tpl_pas_modern_01',
        template_name: matchedPost?.template_name || 'PAS Template',
        copy_angle: matchedPost?.copy_angle || 'Problem-Agitate-Solution'
      };

      const memResult = await syncPostMemoryMetrics(targetPostId, rawMetrics, fallbackContext);
      if (memResult) {
        syncedMemoryCount++;
        if (productId) affectedProductIds.add(productId);

        // Update template performance
        const tplId = memResult.context_at_post?.template_id || fallbackContext.template_id;
        if (tplId) {
          await recordTemplatePerformance(tplId, platform, 'clicks', rawViews, totalClicks);
        }
      }
    }

    console.log(`   ✅ Berhasil merekonsiliasi ${syncedMemoryCount} dokumen memory.`);

    // 5. Update Quarterly Snapshots untuk seluruh produk yang terpengaruh
    console.log(`\n5. Memperbarui Quarterly Summary untuk ${affectedProductIds.size} produk...`);
    for (const pid of affectedProductIds) {
      for (const uid of affectedUserIds) {
        await updateProductQuarterlySnapshot(pid, quarter, uid);
      }
    }
    console.log('   ✅ Quarterly summary produk berhasil diperbarui.');

    // 6. Jalankan Sintesis Pengetahuan (Knowledge Layer)
    console.log('\n6. Menjalankan Knowledge Synthesizer untuk menghasilkan wawasan Jam Emas & Angle...');
    for (const uid of affectedUserIds) {
      const insights = await synthesizeKnowledge(uid);
      console.log(`   User ${uid}: Berhasil menghasilkan ${insights.length} knowledge insights.`);
      insights.forEach(ins => {
        console.log(`   - [${ins.insight_type}] ${ins.finding}`);
      });
    }

    console.log('\n=== 🎉 BACKFILL SELESAI DENGAN SUKSES! DATA ANALITIK & AGENT SUDAH TERSINKRONKAN! ===\n');

  } catch (err) {
    console.error('Fatal Error saat backfill:', err);
  }
}

runBackfill().then(() => process.exit(0));
