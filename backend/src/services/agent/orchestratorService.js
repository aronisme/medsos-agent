const { db } = require('../../config/firebase');
const { profileShopeeProduct } = require('./productIntelligenceService');
const { curateProductMedia } = require('./mediaEvaluatorService');
const { generatePostContent } = require('./copywritingService');
const { checkContentSimilarity } = require('./contentFingerprint');
const { recordPostMemory, getRecentPlatformPosts, getCurrentQuarter } = require('./productPostMemoryService');
const { diagnoseProductPerformance } = require('./diagnosticService');
const { synthesizeKnowledge, getActiveKnowledgeInsights } = require('./knowledgeSynthesizer');
const { logAgentDecision } = require('./decisionLogger');
const crypto = require('crypto');

// Default config
const DEFAULT_CONFIG = {
  autopilot_enabled: true,
  daily_post_quota: 4,
  min_product_cooldown_hours: 48, // 2 hari jeda posting produk yang sama
  target_split: { scaling: 0.5, testing: 0.3, promising: 0.2 },
  default_time_slots: [
    { name: 'Pagi', hour: 7, minute: 30 },
    { name: 'Siang', hour: 12, minute: 15 },
    { name: 'Sore', hour: 17, minute: 0 },
    { name: 'Malam', hour: 20, minute: 0 },
  ],
};

/**
 * Mengambil konfigurasi agent untuk user
 * @param {string} userId 
 */
async function getAgentConfig(userId = 'system') {
  try {
    const docRef = db.collection('agent_config').doc(userId);
    const doc = await docRef.get();
    if (!doc.exists) {
      await docRef.set({ ...DEFAULT_CONFIG, updated_at: new Date().toISOString() });
      return DEFAULT_CONFIG;
    }
    return { ...DEFAULT_CONFIG, ...doc.data() };
  } catch (err) {
    console.error('[getAgentConfig Error]:', err.message);
    return DEFAULT_CONFIG;
  }
}

/**
 * Menyimpan pembaruan konfigurasi agent
 * @param {string} userId 
 * @param {Object} updateData 
 */
async function updateAgentConfig(userId, updateData) {
  try {
    const docRef = db.collection('agent_config').doc(userId);
    await docRef.set({ ...updateData, updated_at: new Date().toISOString() }, { merge: true });
    return { success: true };
  } catch (err) {
    console.error('[updateAgentConfig Error]:', err.message);
    throw err;
  }
}

/**
 * Helper untuk membuat shortlink affiliate khusus postingan
 */
async function createPostShortlink(product, platform, userId) {
  try {
    const shortCode = 'r_' + crypto.randomBytes(3).toString('hex');
    const now = new Date().toISOString();
    const destinationUrl = product.affiliate_url || product.product_url || 'https://shopee.co.id';

    await db.collection('short_links').doc(shortCode).set({
      code: shortCode,
      user_id: userId,
      product_id: product.id,
      title: product.title,
      product_url: product.product_url || '',
      destination_url: destinationUrl,
      platform: platform,
      total_clicks: 0,
      human_clicks: 0,
      created_at: now,
      updated_at: now
    });

    const publicUrl = process.env.PUBLIC_URL || process.env.BASE_URL || 'http://localhost:4000';
    return `${publicUrl}/s/${shortCode}`;
  } catch (err) {
    console.error('[createPostShortlink Error]:', err.message);
    return product.affiliate_url || product.product_url || '';
  }
}

/**
 * Menjalankan 1 Putaran Siklus Otonom (Autonomous Execution Cycle)
 * @param {string} userId - ID User
 * @param {Object} [opts] - { forceRun: boolean, maxPostsToSchedule: number }
 */
async function runAutonomousCycle(userId = 'system', opts = {}) {
  const logSteps = [];
  try {
    const config = await getAgentConfig(userId);
    if (!config.autopilot_enabled && !opts.forceRun) {
      return { success: true, message: 'Autopilot sedang non-aktif.', generated_posts: 0 };
    }

    const quarter = getCurrentQuarter();
    logSteps.push(`Memulai Siklus Otonom ${quarter} untuk User ${userId}`);

    // 1. PHASE 1: Synthesize Knowledge & Learning Layer
    const newInsights = await synthesizeKnowledge(userId);
    logSteps.push(`Learning Layer: Berhasil menyintesis ${newInsights.length} wawasan performa.`);

    // 2. PHASE 2: Ambil Akun Media Sosial yang Aktif
    const accountsSnap = await db.collection('social_accounts')
      .where('user_id', '==', userId)
      .where('is_active', '==', 1)
      .get();

    const socialAccounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (socialAccounts.length === 0) {
      logSteps.push('Peringatan: Tidak ada akun media sosial yang aktif terhubung.');
      return { success: false, message: 'Tidak ada akun sosial aktif.', log: logSteps };
    }

    // 3. PHASE 3: Inventory Classification & Dynamic Quota
    const productsSnap = await db.collection('affiliate_products')
      .where('user_id', '==', userId)
      .get();

    const allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (allProducts.length === 0) {
      logSteps.push('Katalog produk affiliate masih kosong. Menunggu user menstok produk Shopee.');
      return { success: true, message: 'Katalog produk kosong.', log: logSteps };
    }

    // Klasifikasikan produk berdasarkan status
    const pools = {
      new: allProducts.filter(p => !p.lifecycle_status || p.lifecycle_status === 'NEW'),
      testing: allProducts.filter(p => p.lifecycle_status === 'TESTING'),
      promising: allProducts.filter(p => p.lifecycle_status === 'PROMISING'),
      proven: allProducts.filter(p => p.lifecycle_status === 'PROVEN' || p.lifecycle_status === 'SCALING'),
      stopped: allProducts.filter(p => p.lifecycle_status === 'STOPPED' || p.quarterly_status?.status === 'stopped_for_quarter')
    };

    logSteps.push(`Inventori Produk: ${pools.new.length} Baru, ${pools.testing.length} Sedang Diuji, ${pools.promising.length} Menjanjikan, ${pools.proven.length} Pemenang, ${pools.stopped.length} Di-Stop.`);

    // 4. PHASE 4: Jalankan Diagnosis untuk Produk yang Mengalami Masalah
    for (const prod of pools.testing) {
      const summary = prod.quarterly_summary || {};
      if (summary.total_attempts >= 3 && summary.total_clicks < 5) {
        await diagnoseProductPerformance(prod.id, userId);
      }
    }

    // 5. PHASE 5: Grid Scheduler - Cek Antrean Jadwal 24-48 Jam ke Depan
    const existingPostsSnap = await db.collection('posts')
      .where('user_id', '==', userId)
      .where('status', 'in', ['scheduled', 'draft'])
      .get();

    const scheduledCount = existingPostsSnap.docs.length;
    const quotaTarget = Number(opts.maxPostsToSchedule || config.daily_post_quota || 4);

    if (scheduledCount >= quotaTarget * 2) {
      logSteps.push(`Antrean jadwal sudah penuh (${scheduledCount} postingan terjadwal). Tidak perlu membuat jadwal baru saat ini.`);
      return { success: true, message: 'Antrean jadwal sudah penuh.', log: logSteps };
    }

    const postsToGenerate = Math.min(quotaTarget - scheduledCount, 4);
    if (postsToGenerate <= 0) {
      return { success: true, message: 'Antrean mencukupi.', log: logSteps };
    }

    // 6. PHASE 6: Dynamic Selection & Scheduling Pipeline
    const createdPosts = [];
    const now = new Date();

    for (let i = 0; i < postsToGenerate; i++) {
      // Pilih slot waktu berikutnya
      const slotIndex = (scheduledCount + i) % config.default_time_slots.length;
      const slot = config.default_time_slots[slotIndex];

      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + Math.floor((scheduledCount + i) / config.default_time_slots.length));
      targetDate.setHours(slot.hour, slot.minute, 0, 0);

      // Jika waktu slot hari ini sudah terlewat, geser ke besok
      if (targetDate.getTime() <= now.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      // Pilih Akun Medsos Sasaran secara seimbang
      const targetAccount = socialAccounts[i % socialAccounts.length];
      const platform = targetAccount.platform || 'facebook';

      // Dynamic Pool Selection (Dynamic Quota: Prioritaskan New > Proven > Promising)
      let selectedProduct = null;
      if (pools.new.length > 0) {
        selectedProduct = pools.new.shift();
      } else if (pools.proven.length > 0) {
        selectedProduct = pools.proven[Math.floor(Math.random() * pools.proven.length)];
      } else if (pools.promising.length > 0) {
        selectedProduct = pools.promising[Math.floor(Math.random() * pools.promising.length)];
      } else if (pools.testing.length > 0) {
        selectedProduct = pools.testing[Math.floor(Math.random() * pools.testing.length)];
      }

      if (!selectedProduct) break;

      // 6.1. Product Intelligence Profile
      const profile = await profileShopeeProduct(selectedProduct, userId);

      // 6.2. Media Evaluation (Max 2 images / 1 video)
      const mediaCuration = await curateProductMedia(selectedProduct, 'auto', userId);

      // 6.3. Generate Shortlink
      const shortlinkUrl = await createPostShortlink(selectedProduct, platform, userId);

      // 6.4. Generate Content & Copywriting
      const postDraft = await generatePostContent({
        product: selectedProduct,
        profile,
        platform,
        angle: profile.recommended_angles?.[i % profile.recommended_angles.length] || 'Problem-Agitate-Solution',
        objective: 'clicks',
        shortlinkUrl,
      });

      // 6.5. Semantic Content Fingerprint Anti-Duplication Check
      const recentPosts = await getRecentPlatformPosts(userId, platform, 7);
      const similarityCheck = checkContentSimilarity(
        { caption: postDraft.caption, hook_text: postDraft.raw_hook, product_id: selectedProduct.id },
        recentPosts,
        0.85
      );

      if (similarityCheck.is_duplicate) {
        logSteps.push(`Draf konten untuk ${selectedProduct.title} ditolak karena kemiripan semantik tinggi (${similarityCheck.highest_similarity}%).`);
        continue;
      }

      // 6.6. Create Scheduled Post Document
      const postDocRef = db.collection('posts').doc();
      const newPost = {
        id: postDocRef.id,
        user_id: userId,
        title: postDraft.title,
        content: postDraft.caption,
        status: 'scheduled',
        scheduled_at: targetDate.toISOString(),
        post_type: mediaCuration.media_type === 'video' ? 'reel' : 'feed',
        media: mediaCuration.selected_media,
        targets: [{
          id: Math.random().toString(36).substring(2, 9),
          account_id: targetAccount.id,
          platform: targetAccount.platform,
          page_name: targetAccount.page_name,
          status: 'pending',
          error_message: null,
          attempt_count: 0
        }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await postDocRef.set(newPost);

      // 6.7. Record in Product Post Memory
      await recordPostMemory({
        product_id: selectedProduct.id,
        post_id: postDocRef.id,
        quarter,
        objective: 'clicks',
        user_id: userId,
        context_at_post: {
          platform,
          account_id: targetAccount.id,
          account_name: targetAccount.page_name,
          shortlink_code: shortlinkUrl.split('/s/')[1] || '',
          target_audience: profile.target_audience,
          price_at_post: selectedProduct.price,
          original_price_at_post: selectedProduct.original_price,
          discount_at_post: selectedProduct.discount,
          posting_hour: slot.hour,
          posting_day: targetDate.toLocaleDateString('en-US', { weekday: 'long' }),
          hook_type: postDraft.hook_type,
          copy_angle: postDraft.copy_angle,
          template_id: postDraft.template_id,
          template_name: postDraft.template_name,
          media_type: mediaCuration.media_type,
          media_urls: mediaCuration.selected_media.map(m => m.url),
          content_fingerprint: postDraft.content_fingerprint
        },
        raw_metrics: { views: 0, likes: 0, comments: 0, shares: 0, affiliate_clicks: 0 },
        published_at: targetDate.toISOString()
      });

      createdPosts.push({
        postId: postDocRef.id,
        productTitle: selectedProduct.title,
        scheduledAt: targetDate.toISOString(),
        platform
      });

      logSteps.push(`✅ Menjadwalkan post #${postDocRef.id} untuk "${selectedProduct.title.slice(0, 30)}..." pada ${targetDate.toLocaleString('id-ID')} di ${platform}`);
    }

    return {
      success: true,
      generated_posts: createdPosts.length,
      scheduled_items: createdPosts,
      log: logSteps
    };

  } catch (err) {
    console.error('[runAutonomousCycle Fatal Error]:', err.message);
    logSteps.push(`Error Fatal: ${err.message}`);
    return {
      success: false,
      error: err.message,
      log: logSteps
    };
  }
}

module.exports = {
  getAgentConfig,
  updateAgentConfig,
  runAutonomousCycle,
  DEFAULT_CONFIG
};
