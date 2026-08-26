const { db } = require('../../config/firebase');
const { profileShopeeProduct } = require('./productIntelligenceService');
const { curateProductMedia } = require('./mediaEvaluatorService');
const { generatePostContent } = require('./copywritingService');
const { checkContentSimilarity } = require('./contentFingerprint');
const { recordPostMemory, getRecentPlatformPosts, getCurrentQuarter } = require('./productPostMemoryService');
const { diagnoseProductPerformance } = require('./diagnosticService');
const { synthesizeKnowledge, getActiveKnowledgeInsights } = require('./knowledgeSynthesizer');
const { logAgentDecision } = require('./decisionLogger');
const { createExperiment, attachPostToExperiment } = require('./experimentService');
const { syncAllPostsAnalytics } = require('../postAnalytics/syncService');
const crypto = require('crypto');

const CANONICAL_NICHES = {
  UNIVERSAL: { id: 'UNIVERSAL', label: 'Universal / Campuran', keywords: [] },
  GADGET_AUDIO: { id: 'GADGET_AUDIO', label: 'Gadget & Audio', keywords: ['gadget', 'audio', 'tws', 'headset', 'elektronik', 'hp', 'phone', 'charger', 'kabel', 'bluetooth', 'speaker', 'laptop', 'mouse', 'keyboard'] },
  FASHION_WOMEN: { id: 'FASHION_WOMEN', label: 'Fashion Wanita', keywords: ['wanita', 'dress', 'blouse', 'rok', 'hijab', 'gamis', 'tas', 'sepatu', 'cardigan', 'crop', 'outer', 'kulot', 'tunik', 'heels'] },
  FASHION_MEN: { id: 'FASHION_MEN', label: 'Fashion Pria', keywords: ['pria', 'men', 'kaos', 'kemeja', 'hoodie', 'celana', 'dompet', 'sepatu pria', 'sneakers', 'jam tangan'] },
  BEAUTY_SKINCARE: { id: 'BEAUTY_SKINCARE', label: 'Kecantikan & Skincare', keywords: ['skincare', 'serum', 'toner', 'sunscreen', 'lip', 'lipstick', 'moisturizer', 'facial', 'parfum', 'perfume', 'makeup', 'cushion'] },
  HOME_LIVING: { id: 'HOME_LIVING', label: 'Perlengkapan Rumah & Dapur', keywords: ['rumah', 'dapur', 'panci', 'wajan', 'rak', 'organizer', 'sprei', 'lampu', 'dekorasi', 'sapu', 'botol', 'alat masak'] },
  MOM_BABY: { id: 'MOM_BABY', label: 'Ibu & Bayi', keywords: ['bayi', 'baby', 'anak', 'mainan', 'baju anak', 'popok', 'stroller', 'ibu'] },
  AUTOMOTIVE: { id: 'AUTOMOTIVE', label: 'Otomotif & Aksesoris', keywords: ['motor', 'mobil', 'helm', 'sarung', 'oli', 'wiper', 'baut', 'otomotif'] }
};

function normalizeNicheId(rawNiche = '') {
  if (!rawNiche) return 'UNIVERSAL';
  const str = String(rawNiche).trim().toUpperCase().replace(/[\s&/\\-]+/g, '_');
  if (CANONICAL_NICHES[str]) return str;
  for (const [key, conf] of Object.entries(CANONICAL_NICHES)) {
    if (key === 'UNIVERSAL') continue;
    if (str.includes(key) || conf.keywords.some(k => String(rawNiche).toLowerCase().includes(k))) {
      return key;
    }
  }
  return 'UNIVERSAL';
}

function checkNicheCompatibility(product, account) {
  let allowed = account.allowed_niches;
  if (!Array.isArray(allowed) || allowed.length === 0) {
    allowed = ['UNIVERSAL'];
  }
  const normalizedAllowed = allowed.map(n => normalizeNicheId(n));

  if (normalizedAllowed.includes('UNIVERSAL')) {
    return { compatible: true, matchType: 'UNIVERSAL_FALLBACK' };
  }

  const prodNiche = normalizeNicheId(product.agent_profile?.niche || product.category || product.title);
  if (normalizedAllowed.includes(prodNiche)) {
    return { compatible: true, matchType: 'SPECIFIC_MATCH' };
  }

  return { compatible: false, matchType: 'MISMATCH' };
}

// 3 Sesi Terstruktur per Hari (Pagi, Siang, Malam) dengan 3 Slot Konten per Sesi (Total 9 Slot Prime-Time per Akun)
const DEFAULT_CONFIG = {
  autopilot_enabled: true,
  daily_post_quota: 9, // 9 postingan per akun per hari (3 per fase)
  posts_per_phase: 3,  // Minimal 3 konten per akun pada setiap fase
  min_product_cooldown_hours: 48,
  target_split: { scaling: 0.5, testing: 0.3, promising: 0.2 },
  threads_media_mode: 'auto', // 'auto' | 'no_media' | 'with_media'
  default_time_slots: [
    // Sesi 1: Pagi (3 Slot: 06:45, 08:15, 09:30 WIB)
    { session: 'Pagi', name: 'Pagi 1', hour: 6, minute: 45 },
    { session: 'Pagi', name: 'Pagi 2', hour: 8, minute: 15 },
    { session: 'Pagi', name: 'Pagi 3', hour: 9, minute: 30 },
    // Sesi 2: Siang (3 Slot: 11:45, 12:50, 14:10 WIB)
    { session: 'Siang', name: 'Siang 1', hour: 11, minute: 45 },
    { session: 'Siang', name: 'Siang 2', hour: 12, minute: 50 },
    { session: 'Siang', name: 'Siang 3', hour: 14, minute: 10 },
    // Sesi 3: Malam (3 Slot: 18:30, 19:45, 21:00 WIB)
    { session: 'Malam', name: 'Malam 1', hour: 18, minute: 30 },
    { session: 'Malam', name: 'Malam 2', hour: 19, minute: 45 },
    { session: 'Malam', name: 'Malam 3', hour: 21, minute: 0 },
  ],
};

/**
 * Membangun slot waktu dinamis dengan meningkatkan kepadatan konten pada sesi yang memiliki Jam Emas (Peak Golden Hour)
 * @param {Array} activeInsights - Daftar wawasan aktif dari knowledgeSynthesizer
 * @param {Array} baseSlots - Default slot konfigurasi
 */
function buildDynamicTimeSlots(activeInsights = [], baseSlots = DEFAULT_CONFIG.default_time_slots) {
  const peakInsight = activeInsights.find(ins => ins.insight_type === 'peak_hour_preference' && ins.data_summary?.optimal_session);
  if (!peakInsight || !peakInsight.data_summary) {
    return baseSlots;
  }

  const { optimal_session, optimal_hour } = peakInsight.data_summary;
  const peakH = Number(optimal_hour) || 19;

  // Jika Sesi Malam adalah Sesi Emas (Beri 5 slot berkonsentrasi di jam emas)
  if (optimal_session === 'Malam') {
    return [
      // Sesi 1: Pagi (2 Slot)
      { session: 'Pagi', name: 'Pagi 1', hour: 7, minute: 15 },
      { session: 'Pagi', name: 'Pagi 2', hour: 9, minute: 0 },
      // Sesi 2: Siang (2 Slot)
      { session: 'Siang', name: 'Siang 1', hour: 12, minute: 15 },
      { session: 'Siang', name: 'Siang 2', hour: 13, minute: 45 },
      // Sesi 3: Malam - PRIME TIME BOOST (5 Slot di sekitar Jam Emas)
      { session: 'Malam', name: 'Malam 1 (Pre-Prime)', hour: Math.max(peakH - 1, 17), minute: 45 },
      { session: 'Malam', name: 'Malam 2 (Golden Peak 1)', hour: peakH, minute: 15, is_golden_peak: true },
      { session: 'Malam', name: 'Malam 3 (Golden Peak 2)', hour: peakH, minute: 50, is_golden_peak: true },
      { session: 'Malam', name: 'Malam 4 (Post-Prime)', hour: Math.min(peakH + 1, 22), minute: 20 },
      { session: 'Malam', name: 'Malam 5 (Late Relax)', hour: Math.min(peakH + 2, 23), minute: 0 },
    ];
  }

  // Jika Sesi Siang adalah Sesi Emas
  if (optimal_session === 'Siang') {
    return [
      // Sesi 1: Pagi (2 Slot)
      { session: 'Pagi', name: 'Pagi 1', hour: 7, minute: 30 },
      { session: 'Pagi', name: 'Pagi 2', hour: 9, minute: 15 },
      // Sesi 2: Siang - PRIME TIME BOOST (5 Slot)
      { session: 'Siang', name: 'Siang 1 (Pre-Break)', hour: Math.max(peakH - 1, 11), minute: 15 },
      { session: 'Siang', name: 'Siang 2 (Golden Peak 1)', hour: peakH, minute: 5, is_golden_peak: true },
      { session: 'Siang', name: 'Siang 3 (Golden Peak 2)', hour: peakH, minute: 40, is_golden_peak: true },
      { session: 'Siang', name: 'Siang 4 (Afternoon)', hour: Math.min(peakH + 1, 15), minute: 15 },
      { session: 'Siang', name: 'Siang 5 (Late Noon)', hour: Math.min(peakH + 2, 16), minute: 30 },
      // Sesi 3: Malam (2 Slot)
      { session: 'Malam', name: 'Malam 1', hour: 19, minute: 0 },
      { session: 'Malam', name: 'Malam 2', hour: 20, minute: 30 },
    ];
  }

  // Jika Sesi Pagi adalah Sesi Emas
  if (optimal_session === 'Pagi') {
    return [
      // Sesi 1: Pagi - PRIME TIME BOOST (5 Slot)
      { session: 'Pagi', name: 'Pagi 1 (Early Morning)', hour: Math.max(peakH - 1, 6), minute: 30 },
      { session: 'Pagi', name: 'Pagi 2 (Golden Peak 1)', hour: peakH, minute: 15, is_golden_peak: true },
      { session: 'Pagi', name: 'Pagi 3 (Golden Peak 2)', hour: peakH, minute: 50, is_golden_peak: true },
      { session: 'Pagi', name: 'Pagi 4 (Mid Morning)', hour: Math.min(peakH + 1, 10), minute: 15 },
      { session: 'Pagi', name: 'Pagi 5 (Late Morning)', hour: Math.min(peakH + 2, 11), minute: 0 },
      // Sesi 2: Siang (2 Slot)
      { session: 'Siang', name: 'Siang 1', hour: 12, minute: 30 },
      { session: 'Siang', name: 'Siang 2', hour: 14, minute: 0 },
      // Sesi 3: Malam (2 Slot)
      { session: 'Malam', name: 'Malam 1', hour: 19, minute: 15 },
      { session: 'Malam', name: 'Malam 2', hour: 20, minute: 45 },
    ];
  }

  return baseSlots;
}


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

const { buildAffiliateLink, cleanShopeeProductUrl } = require('../../routes/affiliate');

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

    // Cari URL produk Shopee asli yang bersih
    let rawUrl = '';
    const validUrl = getValidShopeeProductUrl(product);
    if (validUrl) {
      rawUrl = validUrl;
    } else if (product.product_url && typeof product.product_url === 'string' && product.product_url.startsWith('http')) {
      rawUrl = cleanShopeeProductUrl(product.product_url);
    } else if (product.affiliate_url && typeof product.affiliate_url === 'string' && product.affiliate_url.startsWith('http') && !product.affiliate_url.includes('/s/')) {
      rawUrl = cleanShopeeProductUrl(product.affiliate_url);
    }

    if (!rawUrl) {
      const itemId = product.item_id || product.raw_item_id;
      const shopId = product.shop_id || product.raw_shop_id || 0;
      if (itemId) {
        rawUrl = `https://shopee.co.id/product/${shopId}/${itemId}`;
      } else {
        rawUrl = 'https://shopee.co.id';
      }
    }

    // Bangun URL tujuan Shopee Affiliate resmi
    const destinationUrl = buildAffiliateLink(rawUrl, tracking, affiliateId);

    // Ambil gambar utama produk jika ada
    let imageUrl = '';
    if (product.image) imageUrl = product.image;
    else if (product.image_url) imageUrl = product.image_url;
    else if (Array.isArray(product.images) && product.images.length > 0) imageUrl = product.images[0];
    else if (Array.isArray(product.media) && product.media.length > 0) imageUrl = product.media[0]?.url || '';

    await db.collection('short_links').doc(shortCode).set({
      code: shortCode,
      user_id: userId,
      product_id: product.id || '',
      title: product.title || 'Shopee Product',
      image_url: imageUrl,
      price: product.price || 0,
      product_url: rawUrl,
      destination_url: destinationUrl,
      platform: platform,
      tracking: tracking,
      total_clicks: 0,
      human_clicks: 0,
      bot_clicks: 0,
      created_at: now,
      updated_at: now
    });

    const rawPublicUrl = process.env.PUBLIC_URL || process.env.BASE_URL || 'https://shopee-link-aff.vercel.app';
    const publicUrl = rawPublicUrl.replace(/medsos-agent\.vercel\.app/g, 'shopee-link-aff.vercel.app');
    return `${publicUrl}/s/${shortCode}`;
  } catch (err) {
    console.error('[createPostShortlink Error]:', err.message);
    return product.affiliate_url || product.product_url || '';
  }
}

/**
 * Helper untuk memvalidasi dan merekonstruksi URL produk Shopee yang sah & bersih
 */
function getValidShopeeProductUrl(product) {
  if (!product) return null;
  let url = String(product.product_url || '').trim();
  
  if (url && (url.startsWith('http://') || url.startsWith('https://')) && url !== 'https://shopee.co.id') {
    // Jangan gunakan jika itu shortlink internal
    if (!url.includes('/s/')) {
      return cleanShopeeProductUrl(url);
    }
  }

  const affUrl = String(product.affiliate_url || '').trim();
  if (affUrl && (affUrl.startsWith('http://') || affUrl.startsWith('https://')) && !affUrl.includes('/s/')) {
    return cleanShopeeProductUrl(affUrl);
  }
  
  const itemId = product.item_id || product.raw_item_id;
  const shopId = product.shop_id || product.raw_shop_id || 0;
  if (itemId && itemId !== 'undefined') {
    return `https://shopee.co.id/product/${shopId}/${itemId}`;
  }
  
  return null;
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

    // 0. PHASE 0: Pre-Cycle Analytics Sync (Meta API & Shortlinks Tracker)
    try {
      await syncAllPostsAnalytics(userId, { limit: 20 });
      logSteps.push('Sinkronisasi Analitik: Berhasil menyinkronkan metrik Meta & klik link terbaru ke memori.');
    } catch (syncErr) {
      console.warn('[runAutonomousCycle Pre-Sync Warning]:', syncErr.message);
    }

    // 1. PHASE 1: Synthesize Knowledge & Evaluasi Sesi Sebelumnya
    const newInsights = await synthesizeKnowledge(userId);
    const activeInsights = await getActiveKnowledgeInsights(userId);
    logSteps.push(`Evaluasi Sesi: Berhasil menganalisis performa & menyintesis ${newInsights.length} wawasan aktif.`);

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
      .where('is_active', 'in', [1, true, '1'])
      .get();

    // Filter platform: HANYA target Facebook dan Threads karena mendukung link klik langsung di caption
    const socialAccounts = accountsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(acc => ['facebook', 'threads'].includes(acc.platform));

    if (socialAccounts.length === 0) {
      logSteps.push('Peringatan: Tidak ada akun Facebook atau Threads yang aktif terhubung.');
      return { success: false, message: 'Tidak ada akun Facebook atau Threads aktif (Instagram dinonaktifkan untuk link caption).', log: logSteps };
    }

    // 3. PHASE 3: Inventory Classification & Strict Link Validation
    const productsSnap = await db.collection('affiliate_products')
      .where('user_id', '==', userId)
      .get();

    const allProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (allProducts.length === 0) {
      logSteps.push('Katalog produk affiliate masih kosong. Menunggu user menstok produk Shopee.');
      return { success: true, message: 'Katalog produk kosong.', log: logSteps };
    }

    // Filter KETAT: Pastikan HANYA produk dengan link sah yang dipilih!
    const validProducts = [];
    let missingLinkCount = 0;

    for (const p of allProducts) {
      const validUrl = getValidShopeeProductUrl(p);
      if (validUrl) {
        p.product_url = validUrl;
        validProducts.push(p);
      } else {
        missingLinkCount++;
      }
    }

    if (missingLinkCount > 0) {
      logSteps.push(`⚠️ Proteksi Link: Mengabaikan ${missingLinkCount} produk karena link produk kosong / tidak valid.`);
    }

    if (validProducts.length === 0) {
      logSteps.push('Semua produk di katalog belum memiliki Link Shopee yang valid. Silakan periksa tab Produk Affiliate.');
      return { success: false, message: 'Semua produk tidak memiliki link produk yang valid.', log: logSteps };
    }

    // Klasifikasikan produk berdasarkan status
    const pools = {
      new: validProducts.filter(p => !p.lifecycle_status || p.lifecycle_status === 'NEW'),
      testing: validProducts.filter(p => p.lifecycle_status === 'TESTING'),
      promising: validProducts.filter(p => p.lifecycle_status === 'PROMISING'),
      proven: validProducts.filter(p => p.lifecycle_status === 'PROVEN' || p.lifecycle_status === 'SCALING'),
      stopped: validProducts.filter(p => p.lifecycle_status === 'STOPPED' || p.quarterly_status?.status === 'stopped_for_quarter')
    };

    logSteps.push(`Inventori Valid: ${pools.new.length} Baru, ${pools.testing.length} Sedang Diuji, ${pools.promising.length} Menjanjikan, ${pools.proven.length} Pemenang, ${pools.stopped.length} Di-Stop.`);

    // 4. PHASE 4: Jalankan Diagnosis untuk Produk yang Mengalami Masalah
    for (const prod of pools.testing) {
      const summary = prod.quarterly_summary || {};
      if (summary.total_attempts >= 3 && summary.total_clicks < 5) {
        await diagnoseProductPerformance(prod.id, userId);
      }
    }

    // 5. PHASE 5: Dynamic Prime-Time Multi-Account Grid Scheduler
    const existingPostsSnap = await db.collection('posts')
      .where('user_id', '==', userId)
      .where('status', 'in', ['scheduled', 'draft'])
      .get();

    const existingPosts = existingPostsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Ambil riwayat memori posting 48 jam terakhir dari product_post_memory (Ledger-Backed Cooldown per Platform)
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const recentMemoriesSnap = await db.collection('product_post_memory')
      .where('user_id', '==', userId)
      .where('published_at', '>=', fortyEightHoursAgo)
      .get();

    const platformCooldownSet = new Set();
    recentMemoriesSnap.docs.forEach(doc => {
      const data = doc.data();
      const prodId = data.product_id;
      const plat = data.context_at_post?.platform;
      if (prodId && plat) {
        platformCooldownSet.add(`${prodId}_${plat}`);
      }
    });

    const inBatchScheduledKeys = new Set();
    
    // Bangun target slots dengan alokasi kepadatan jam emas hasil pembelajaran analitik
    const targetSlots = buildDynamicTimeSlots(activeInsights, config.default_time_slots || DEFAULT_CONFIG.default_time_slots);
    const goldenInsight = activeInsights.find(ins => ins.insight_type === 'peak_hour_preference');
    if (goldenInsight?.data_summary) {
      logSteps.push(`Jam Emas Terdeteksi: Meningkatkan kepadatan slot pada Sesi ${goldenInsight.data_summary.optimal_session} (Jam ${goldenInsight.data_summary.optimal_hour}:00 WIB, CTR ${goldenInsight.data_summary.ctr_percent}%).`);
    }

    const createdPosts = [];
    const nowUtc = Date.now();

    // Dapatkan hari ini dalam WIB (UTC+7)
    const wibNow = new Date(Date.now() + 7 * 3600 * 1000);
    const targetWibYear = wibNow.getUTCFullYear();
    const targetWibMonth = wibNow.getUTCMonth();
    const targetWibDate = wibNow.getUTCDate();

    // Loop untuk setiap akun media sosial aktif (Threads & Facebook)
    for (let accIdx = 0; accIdx < socialAccounts.length; accIdx++) {
      const targetAccount = socialAccounts[accIdx];
      const platform = targetAccount.platform || 'facebook';

      // Ambil postingan yang sudah dijadwalkan khusus untuk akun ini
      const accountExistingPosts = existingPosts.filter(p => 
        Array.isArray(p.targets) && p.targets.some(t => t.account_id === targetAccount.id)
      );

      // Hitung jitter menit antar akun (misal akun 1: +0m, akun 2: +7m, akun 3: +14m)
      const accountJitterMin = (accIdx * 7) % 25;

      // Iterasi ke slot waktu dinamis
      for (let slotIdx = 0; slotIdx < targetSlots.length; slotIdx++) {
        const slot = targetSlots[slotIdx];

        // Tentukan jam & menit slot dengan jitter akun
        let slotMinute = slot.minute + accountJitterMin;
        let slotHour = slot.hour;
        if (slotMinute >= 60) {
          slotHour += Math.floor(slotMinute / 60);
          slotMinute = slotMinute % 60;
        }

        // Tentukan tanggal eksekusi WIB (hari ini atau besok jika jam sudah lewat)
        let targetDate = new Date(Date.UTC(targetWibYear, targetWibMonth, targetWibDate, slotHour - 7, slotMinute, 0, 0));
        if (targetDate.getTime() <= nowUtc + 5 * 60 * 1000) {
          targetDate = new Date(Date.UTC(targetWibYear, targetWibMonth, targetWibDate + 1, slotHour - 7, slotMinute, 0, 0));
        }

        // Cek apakah akun ini sudah memiliki postingan yang dijadwalkan di sekitar slot waktu ini (+- 30 menit)
        const hasSlotCovered = accountExistingPosts.some(p => {
          if (!p.scheduled_at) return false;
          const pTime = new Date(p.scheduled_at).getTime();
          return Math.abs(pTime - targetDate.getTime()) < 30 * 60 * 1000;
        });

        if (hasSlotCovered) {
          continue; // Slot sudah terisi untuk akun ini
        }

        // ---------------------------------------------------------------------------------
        // PRE-FILTER PIPELINE & PROPORTIONAL CANDIDATE SELECTION (MAX_CANDIDATE_ATTEMPTS = 5)
        // ---------------------------------------------------------------------------------
        const MAX_CANDIDATE_ATTEMPTS = 5;
        let selectedProduct = null;
        let selectedMediaCuration = null;
        let isTestingProduct = false;

        const getEligibleFromList = (list = []) => {
          return list.filter(p => {
            if (!p || !p.id) return false;
            // 1. Lifecycle Check
            const status = p.lifecycle_status || 'NEW';
            if (status === 'STOPPED' || p.quarterly_status?.status === 'stopped_for_quarter') return false;

            // 2. Cooldown & In-batch Reservation Check (Key = product_id + platform)
            const cooldownKey = `${p.id}_${platform}`;
            if (platformCooldownSet.has(cooldownKey) || inBatchScheduledKeys.has(cooldownKey)) return false;

            // 3. Account Niche Compatibility Check (Specific Match -> Universal Fallback)
            const nicheCheck = checkNicheCompatibility(p, targetAccount);
            if (!nicheCheck.compatible) return false;

            return true;
          });
        };

        // Tentukan prioritas pool kandidat
        let priorityPools = [];
        if (slot.is_golden_peak) {
          // Golden Peak Override: 80% PROVEN-first, fallback dinamis ke PROMISING, TESTING, NEW
          priorityPools = [pools.proven, pools.promising, pools.testing, pools.new];
        } else {
          // Normal Slot Target: 50% Winner (PROVEN+PROMISING), 30% Testing (TESTING), 20% Discovery (NEW)
          const roll = Math.random();
          if (roll < 0.50) {
            priorityPools = [[...pools.proven, ...pools.promising], pools.testing, pools.new];
          } else if (roll < 0.80) {
            priorityPools = [pools.testing, [...pools.proven, ...pools.promising], pools.new];
          } else {
            priorityPools = [pools.new, pools.testing, [...pools.proven, ...pools.promising]];
          }
        }

        // Kumpulkan antrean kandidat yang memenuhi syarat pre-filter
        const candidateQueue = [];
        const seenCandidateIds = new Set();

        for (const pool of priorityPools) {
          const eligible = getEligibleFromList(pool);
          // Acak urutan kandidat dalam tier yang sama untuk rotasi yang adil
          const shuffled = [...eligible].sort(() => Math.random() - 0.5);
          shuffled.forEach(p => {
            if (!seenCandidateIds.has(p.id)) {
              seenCandidateIds.add(p.id);
              candidateQueue.push(p);
            }
          });
        }

        // Tentukan preferensi media khusus akun Threads jika ada
        const accountThreadsMediaMode = targetAccount.threads_media_mode || config.threads_media_mode || 'auto';

        // Candidate Replacement Retry Loop (Maksimal 5 percobaan sebelum menyatakan NO_ELIGIBLE_CANDIDATE)
        let attemptCount = 0;
        while (candidateQueue.length > 0 && attemptCount < MAX_CANDIDATE_ATTEMPTS) {
          attemptCount++;
          const candidate = candidateQueue.shift();

          // Cek ketersediaan media segar khusus platform ini
          const mediaCuration = await curateProductMedia(candidate, 'auto', platform, userId, {
            threadsMediaMode: accountThreadsMediaMode,
            allowFallbackNoMedia: true
          });
          
          if (mediaCuration.no_fresh_media || (!mediaCuration.selected_media && mediaCuration.media_type !== 'text')) {
            logSteps.push(`[${platform.toUpperCase()}] Kandidat #${attemptCount} "${candidate.title.slice(0, 20)}..." dilewati: Media sudah terpakai di ${platform}.`);
            continue;
          }

          // Kandidat diterima!
          selectedProduct = candidate;
          selectedMediaCuration = mediaCuration;
          isTestingProduct = (!candidate.lifecycle_status || candidate.lifecycle_status === 'NEW' || candidate.lifecycle_status === 'TESTING');

          // Kunci cooldown & in-batch reservation
          const lockKey = `${candidate.id}_${platform}`;
          platformCooldownSet.add(lockKey);
          inBatchScheduledKeys.add(lockKey);
          break;
        }

        if (!selectedProduct) {
          logSteps.push(`[${platform.toUpperCase()}] Slot ${slot.name} (${slot.session}): NO_ELIGIBLE_CANDIDATE (tidak ada produk memenuhi syarat niche/cooldown/media).`);
          continue; // Lewati slot secara graceful tanpa memicu error
        }

        const mediaCuration = selectedMediaCuration;
        const isNoMediaMode = mediaCuration.media_type === 'text' || (platform === 'threads' && accountThreadsMediaMode === 'no_media');

        // 6.1. Profile Produk (Zero Redundant AI Calls: gunakan cache jika sudah ada)
        const profile = (selectedProduct.agent_profile && selectedProduct.agent_profile.niche)
          ? selectedProduct.agent_profile
          : await profileShopeeProduct(selectedProduct, userId);

        const formattedMedia = isNoMediaMode
          ? []
          : (mediaCuration.selected_media || []).map(item => {
              const url = typeof item === 'string' ? item : item?.url || item?.media_url || '';
              const type = (typeof item === 'object' && item?.type) ? item.type : (mediaCuration.media_type || 'image');
              return {
                media_url: url,
                media_type: type
              };
            }).filter(m => m.media_url && typeof m.media_url === 'string' && m.media_url.startsWith('http'));

        // 6.3. Generate Shortlink Unik Khusus Akun Ini
        const shortlinkUrl = await createPostShortlink(selectedProduct, platform, userId);

        // Inisiasi Otomatis Eksperimen A/B untuk produk Testing
        let linkedExperimentId = null;
        let variantId = 'A';
        let customAngle = profile.recommended_angles?.[(accIdx + slotIdx) % (profile.recommended_angles?.length || 1)] || 'Problem-Agitate-Solution';

        if (isTestingProduct && selectedProduct.id) {
          try {
            const expSnap = await db.collection('experiments')
              .where('user_id', '==', userId)
              .where('product_id', '==', String(selectedProduct.id))
              .where('status', '==', 'running')
              .limit(1)
              .get();

            if (expSnap.empty) {
              const varA_tpl = platform === 'threads'
                ? (isNoMediaMode ? 'tpl_threads_link_preview_12' : 'tpl_threads_in_this_economy_07')
                : 'tpl_pas_modern_01';
              const varB_tpl = platform === 'threads'
                ? (isNoMediaMode ? 'tpl_threads_value_card_13' : 'tpl_threads_punchy_06')
                : 'tpl_review_spill_02';

              const newExp = await createExperiment({
                productId: selectedProduct.id,
                quarter,
                hypothesis: `Menguji apakah sudut pandang PAS/Value Shock menghasilkan CTR lebih tinggi dibanding Honest Review untuk ${selectedProduct.title.slice(0, 30)}`,
                objective: 'clicks',
                variants: [
                  { variant_id: 'A', template_id: varA_tpl, copy_angle: 'Problem-Agitate-Solution' },
                  { variant_id: 'B', template_id: varB_tpl, copy_angle: 'Honest Review' }
                ],
                userId
              });
              linkedExperimentId = newExp.id;
              variantId = 'A';
              customAngle = 'Problem-Agitate-Solution';
            } else {
              const expDoc = expSnap.docs[0];
              linkedExperimentId = expDoc.id;
              const expData = expDoc.data();
              const varAHasPost = expData.variants?.find(v => v.variant_id === 'A')?.post_id;
              variantId = varAHasPost ? 'B' : 'A';
              customAngle = variantId === 'B' ? 'Honest Review' : 'Problem-Agitate-Solution';
            }
          } catch (expErr) {
            console.warn('[runAutonomousCycle Experiment Warning]:', expErr.message);
          }
        }

        // 6.4. Generate Copywriting Segar Khusus Sesi
        const postDraft = await generatePostContent({
          product: selectedProduct,
          profile,
          platform,
          angle: customAngle,
          objective: 'clicks',
          shortlinkUrl,
          sessionInfo: {
            session: slot.session || 'Sesi',
            hour: slot.hour || 12,
            minute: slot.minute || 0
          },
          threadsMediaMode: isNoMediaMode ? 'no_media' : accountThreadsMediaMode
        });

        // 6.5. Semantic Content Fingerprint Check
        const recentPosts = await getRecentPlatformPosts(userId, platform, 7);
        const similarityCheck = checkContentSimilarity(
          { caption: postDraft.caption, hook_text: postDraft.raw_hook, product_id: selectedProduct.id },
          recentPosts,
          0.85
        );

        if (similarityCheck.is_duplicate) {
          logSteps.push(`Draf untuk @${targetAccount.page_name} ditolak karena kemiripan semantik (${similarityCheck.highest_similarity}%).`);
          continue;
        }

        // 6.6. Simpan Dokumen Postingan Terjadwal
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
          product_id: selectedProduct.id,
          cta_type: postDraft.cta_type || (platform === 'threads' ? (isNoMediaMode ? 'link_card_cta' : 'soft_cta') : 'direct_link_cta'),
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

        // Khusus Threads: Sertakan struktur First-Reply HANYA jika bukan mode no-media (karena link sudah di caption)
        if (platform === 'threads' && postDraft.first_reply_text && !isNoMediaMode) {
          newPost.first_reply = {
            enabled: true,
            text: postDraft.first_reply_text,
            product_id: String(selectedProduct.id),
            affiliate_url: shortlinkUrl || selectedProduct.affiliate_url || selectedProduct.product_url || '',
            status: 'pending',
            reply_id: null,
            reply_attempts: 0,
            reply_last_error: null,
            reply_published_at: null
          };
        }

        await postDocRef.set(newPost);

        // Jika terhubung eksperimen A/B, attach post ke varian
        if (linkedExperimentId) {
          await attachPostToExperiment(linkedExperimentId, variantId, postDocRef.id);
        }

        // 6.7. Rekam ke Product Post Memory
        await recordPostMemory({
          product_id: selectedProduct.id,
          post_id: postDocRef.id,
          experiment_id: linkedExperimentId,
          variant_id: variantId,
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
          accountName: targetAccount.page_name,
          productTitle: selectedProduct.title,
          scheduledAt: targetDate.toISOString(),
          platform,
          session: slot.session || 'Sesi',
          isGoldenPeak: Boolean(slot.is_golden_peak)
        });

        const goldenTag = slot.is_golden_peak ? '🌟 [JAM EMAS]' : '';
        logSteps.push(`✅ [${slot.session}] ${goldenTag} @${targetAccount.page_name} (${platform}) - "${selectedProduct.title.slice(0, 25)}..." pada ${targetDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`);
      }
    }

    if (createdPosts.length > 0) {
      try {
        let reportMessage = `<b>🤖 AGEN AI AUTOPILOT CYCLE</b>\n\n`;
        reportMessage += `Siklus otonom selesai. Telah dijadwalkan <b>${createdPosts.length} postingan baru</b>:\n\n`;
        createdPosts.forEach(p => {
          reportMessage += `• <b>${p.accountName} (${p.platform.toUpperCase()})</b>\n`;
          reportMessage += `  Produk: ${p.productTitle}\n`;
          const timeStr = new Date(p.scheduledAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
          reportMessage += `  Jadwal: ${timeStr} WIB\n\n`;
        });

        const { sendTelegramReport } = require('../telegramService');
        sendTelegramReport(userId, reportMessage).catch(console.error);
      } catch (tgErr) {
        console.warn('[runAutonomousCycle] Failed to send Telegram report:', tgErr.message);
      }
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
  createPostShortlink,
  getValidShopeeProductUrl,
  DEFAULT_CONFIG
};
