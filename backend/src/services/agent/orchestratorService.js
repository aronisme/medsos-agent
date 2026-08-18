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

// 3 Sesi Terstruktur per Hari (Pagi, Siang, Malam) dengan 6 Slot Prime-Time
const DEFAULT_CONFIG = {
  autopilot_enabled: true,
  daily_post_quota: 5, // Minimal 5 postingan per hari per platform
  min_product_cooldown_hours: 48,
  target_split: { scaling: 0.5, testing: 0.3, promising: 0.2 },
  default_time_slots: [
    // Sesi 1: Pagi (Morning Session)
    { session: 'Pagi', name: 'Pagi 1', hour: 7, minute: 15 },
    { session: 'Pagi', name: 'Pagi 2', hour: 8, minute: 45 },
    // Sesi 2: Siang (Afternoon Session)
    { session: 'Siang', name: 'Siang 1', hour: 11, minute: 45 },
    { session: 'Siang', name: 'Siang 2', hour: 13, minute: 15 },
    // Sesi 3: Malam (Evening/Night Session)
    { session: 'Malam', name: 'Malam 1', hour: 19, minute: 15 },
    { session: 'Malam', name: 'Malam 2', hour: 20, minute: 45 },
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

const { buildAffiliateLink } = require('../../routes/affiliate');

/**
 * Helper untuk membuat link afiliasi Shopee resmi + shortlink internal khusus postingan
 */
async function createPostShortlink(product, platform, userId) {
  try {
    const shortCode = 'r_' + crypto.randomBytes(3).toString('hex');
    const now = new Date().toISOString();
    
    const affiliateId = process.env.SHOPEE_AFFILIATE_ID || '11328861338';
    const tracking = {
      source: platform,
      campaign: 'auto_agent',
      content: product.id || 'shopee_product',
      custom_1: 'medsos_agent'
    };

    const rawUrl = product.product_url || product.affiliate_url || 'https://shopee.co.id';
    
    // Otomatis ubah menjadi Shopee Affiliate link jika belum berformat an_redir
    let destinationUrl = product.affiliate_url;
    if (!destinationUrl || !destinationUrl.includes('an_redir')) {
      try {
        destinationUrl = buildAffiliateLink(rawUrl, tracking, affiliateId);
      } catch {
        destinationUrl = rawUrl;
      }
    }

    await db.collection('short_links').doc(shortCode).set({
      code: shortCode,
      user_id: userId,
      product_id: product.id || '',
      title: product.title || 'Shopee Product',
      product_url: product.product_url || '',
      destination_url: destinationUrl,
      platform: platform,
      tracking: tracking,
      total_clicks: 0,
      human_clicks: 0,
      created_at: now,
      updated_at: now
    });

    const publicUrl = process.env.PUBLIC_URL || process.env.BASE_URL || 'https://shopee-link-aff.vercel.app';
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
    logSteps.push(`Memulai Siklus Otonom ${quarter} (3 Sesi per Hari) untuk User ${userId}`);

    // 1. PHASE 1: Synthesize Knowledge & Evaluasi Sesi Sebelumnya
    const newInsights = await synthesizeKnowledge(userId);
    logSteps.push(`Evaluasi Sesi: Berhasil menganalisis performa sesi sebelumnya & menyintesis ${newInsights.length} wawasan.`);

    await logAgentDecision({
      userId,
      decisionType: 'SESSION_EVALUATION',
      productId: 'system',
      summary: 'Evaluasi Akhir Sesi: Mempelajari Metrik & Menyesuaikan Sesi Berikutnya',
      reasoning: 'Mengevaluasi hasil tayangan & klik link dari sesi sebelumnya, memperbarui bobot Multi-Armed Bandit, dan menyiapkan strategi konten untuk sesi berikutnya.',
      metadata: { insights_count: newInsights.length }
    });

    // 2. PHASE 2: Ambil Akun Media Sosial yang Aktif (Stop IG, fokus Facebook & Threads)
    const accountsSnap = await db.collection('social_accounts')
      .where('user_id', '==', userId)
      .where('is_active', '==', 1)
      .get();

    // Filter platform: HANYA target Facebook dan Threads karena mendukung link klik langsung di caption
    const socialAccounts = accountsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(acc => acc.platform !== 'instagram');

    if (socialAccounts.length === 0) {
      logSteps.push('Peringatan: Tidak ada akun Facebook atau Threads yang aktif terhubung.');
      return { success: false, message: 'Tidak ada akun Facebook atau Threads aktif (Instagram dinonaktifkan untuk link caption).', log: logSteps };
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

    logSteps.push(`Inventori: ${pools.new.length} Baru, ${pools.testing.length} Sedang Diuji, ${pools.promising.length} Menjanjikan, ${pools.proven.length} Pemenang, ${pools.stopped.length} Di-Stop.`);

    // 4. PHASE 4: Jalankan Diagnosis untuk Produk yang Mengalami Masalah
    for (const prod of pools.testing) {
      const summary = prod.quarterly_summary || {};
      if (summary.total_attempts >= 3 && summary.total_clicks < 5) {
        await diagnoseProductPerformance(prod.id, userId);
      }
    }

    // 5. PHASE 5: Grid Scheduler - 3 Sesi Harian (Minimal 5 post per hari)
    const existingPostsSnap = await db.collection('posts')
      .where('user_id', '==', userId)
      .where('status', 'in', ['scheduled', 'draft'])
      .get();

    const scheduledCount = existingPostsSnap.docs.length;
    const quotaTarget = Number(opts.maxPostsToSchedule || config.daily_post_quota || 5);

    if (scheduledCount >= quotaTarget * 2) {
      logSteps.push(`Antrean jadwal sudah penuh (${scheduledCount} postingan terjadwal).`);
      return { success: true, message: 'Antrean jadwal sudah penuh.', log: logSteps };
    }

    const postsToGenerate = Math.min(quotaTarget - scheduledCount, 6);
    if (postsToGenerate <= 0) {
      return { success: true, message: 'Antrean mencukupi.', log: logSteps };
    }

    // 6. PHASE 6: Dynamic Selection & Scheduling Pipeline
    const createdPosts = [];
    const now = new Date();

    for (let i = 0; i < postsToGenerate; i++) {
      const slotIndex = (scheduledCount + i) % config.default_time_slots.length;
      const slot = config.default_time_slots[slotIndex];

      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + Math.floor((scheduledCount + i) / config.default_time_slots.length));
      targetDate.setHours(slot.hour, slot.minute, 0, 0);

      if (targetDate.getTime() <= now.getTime()) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      // Pilih Akun Medsos Sasaran (FB / Threads)
      const targetAccount = socialAccounts[i % socialAccounts.length];
      const platform = targetAccount.platform || 'facebook';

      // Dynamic Pool Selection
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

      // Format media menjadi object { media_url, media_type } yang valid
      const formattedMedia = (mediaCuration.selected_media || []).map(item => {
        const url = typeof item === 'string' ? item : item?.url || item?.media_url || '';
        const type = (typeof item === 'object' && item?.type) ? item.type : (mediaCuration.media_type || 'image');
        return {
          media_url: url,
          media_type: type
        };
      }).filter(m => m.media_url && typeof m.media_url === 'string' && m.media_url.startsWith('http'));

      // 6.3. Generate Shortlink
      const shortlinkUrl = await createPostShortlink(selectedProduct, platform, userId);

      // 6.4. Generate Content & Copywriting (Clean text without asterisks)
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
        media: formattedMedia,
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
          media_urls: formattedMedia.map(m => m.media_url),
          content_fingerprint: postDraft.content_fingerprint
        },
        raw_metrics: { views: 0, likes: 0, comments: 0, shares: 0, affiliate_clicks: 0 },
        published_at: targetDate.toISOString()
      });

      createdPosts.push({
        postId: postDocRef.id,
        productTitle: selectedProduct.title,
        scheduledAt: targetDate.toISOString(),
        platform,
        session: slot.session || 'Sesi'
      });

      logSteps.push(`✅ [${slot.session || 'Sesi'}] Menjadwalkan post #${postDocRef.id} "${selectedProduct.title.slice(0, 30)}..." pada ${targetDate.toLocaleString('id-ID')} di ${platform}`);
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
