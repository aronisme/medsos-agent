const { db } = require('../../config/firebase');
const { getProductPostHistory } = require('./productPostMemoryService');
const { logAgentDecision } = require('./decisionLogger');

/**
 * Diagnostic Root-Cause Analyzer
 * Mendiagnosis penyebab rendahnya performa produk ke dalam 4 Kategori Masalah
 * (Traffic, Content, Offer, atau Product) sebelum memutuskan penghentian kuartal.
 * 
 * @param {string} productId - ID Produk Shopee
 * @param {string} userId - ID User
 * @returns {Promise<Object>} Diagnostic result & action recommendation
 */
async function diagnoseProductPerformance(productId, userId = 'system') {
  try {
    const prodRef = db.collection('affiliate_products').doc(productId);
    const prodDoc = await prodRef.get();

    if (!prodDoc.exists) {
      return { error: 'Produk tidak ditemukan.' };
    }

    const product = prodDoc.data();
    const history = await getProductPostHistory(productId, 20);

    if (history.length === 0) {
      return {
        product_id: productId,
        diagnosis_category: 'INSUFFICIENT_DATA',
        finding: 'Produk belum pernah diposting.',
        recommended_action: 'PROCEED_TESTING',
        can_stop: false
      };
    }

    // Hitung total views, total clicks, variasi platform, dan variasi angle
    let totalViews = 0;
    let totalClicks = 0;
    const platformsTested = new Set();
    const anglesTested = new Set();
    const mediaTypesTested = new Set();
    const hoursTested = new Set();

    history.forEach(p => {
      totalViews += p.raw_metrics?.views || 0;
      totalClicks += p.raw_metrics?.affiliate_clicks || 0;
      if (p.context_at_post?.platform) platformsTested.add(p.context_at_post.platform);
      if (p.context_at_post?.copy_angle) anglesTested.add(p.context_at_post.copy_angle);
      if (p.context_at_post?.media_type) mediaTypesTested.add(p.context_at_post.media_type);
      if (p.context_at_post?.posting_hour !== undefined) hoursTested.add(p.context_at_post.posting_hour);
    });

    const avgCtr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;

    // 1. Cek Apakah Performa Sebenarnya Bagus
    if (avgCtr >= 1.5 || totalClicks >= 20) {
      return {
        product_id: productId,
        diagnosis_category: 'HEALTHY_PERFORMANCE',
        finding: `Produk memiliki respon sehat (CTR ${avgCtr.toFixed(2)}%, ${totalClicks} klik).`,
        recommended_action: 'PROMOTE_TO_PROVEN',
        can_stop: false
      };
    }

    // Ambil daftar akun aktif pengguna dari database untuk mengetahui platform mana saja yang benar-benar aktif
    const accountsSnap = await db.collection('social_accounts')
      .where('user_id', '==', userId)
      .where('is_active', 'in', [1, true, '1'])
      .get();

    // HANYA ambil platform yang didukung untuk posting autopilot afiliasi (Facebook & Threads)
    const activePostingPlatforms = Array.from(new Set(
      accountsSnap.docs
        .map(d => d.data().platform)
        .filter(p => p && ['facebook', 'threads'].includes(p))
    ));

    // Platform aktif yang belum pernah diuji untuk produk ini
    const remainingPlatforms = activePostingPlatforms.filter(p => !platformsTested.has(p));

    // 2. DIAGNOSIS 1: Traffic Problem (Hanya jika user memiliki platform aktif lain yang belum diuji)
    if (remainingPlatforms.length > 0 && history.length >= 2) {
      const nextPlatform = remainingPlatforms[0];

      const result = {
        product_id: productId,
        diagnosis_category: 'TRAFFIC_PROBLEM',
        finding: `Produk baru dicoba di platform ${Array.from(platformsTested).join(', ')} (${history.length}x). Masih ada platform aktif yang belum diuji (${nextPlatform}).`,
        recommended_action: `TEST_ON_ALTERNATIVE_PLATFORM_${nextPlatform.toUpperCase()}`,
        next_test_config: { platform: nextPlatform },
        can_stop: false,
        reasoning: `Jangan hentikan produk sebelum menguji di platform aktif lain (${nextPlatform}).`
      };

      await logAgentDecision({
        userId,
        decisionType: 'DIAGNOSTIC_ANALYSIS',
        productId,
        summary: `Diagnosis: Traffic Problem (Coba di ${nextPlatform})`,
        reasoning: result.reasoning,
        metadata: result
      });

      return result;
    }

    // 3. DIAGNOSIS 2: Content Problem (Angle & Media Kurang Bervariasi)
    if ((anglesTested.size <= 1 || mediaTypesTested.size <= 1) && history.length < 3) {
      const result = {
        product_id: productId,
        diagnosis_category: 'CONTENT_PROBLEM',
        finding: `Produk baru menggunakan 1 variasi sudut pandang (${Array.from(anglesTested).join(', ')}) atau 1 tipe media.`,
        recommended_action: 'TEST_WITH_DIFFERENT_ANGLE_OR_MEDIA',
        next_test_config: {
          angle: 'Honest Review',
          media_type: mediaTypesTested.has('image') ? 'video' : 'image'
        },
        can_stop: false,
        reasoning: 'Rendahnya interaksi kemungkinan akibat materi hook/media yang kurang memikat, bukan produknya.'
      };

      await logAgentDecision({
        userId,
        decisionType: 'DIAGNOSTIC_ANALYSIS',
        productId,
        summary: 'Diagnosis: Content Problem (Coba Sudut Pandang/Media Baru)',
        reasoning: result.reasoning,
        metadata: result
      });

      return result;
    }

    // 4. DIAGNOSIS 3: Offer Problem (Harga / Diskon Tidak Menarik)
    if (totalViews >= 1500 && totalClicks <= 2) {
      // Views banyak tapi klik hampir 0
      const result = {
        product_id: productId,
        diagnosis_category: 'OFFER_PROBLEM',
        finding: `Tayangan cukup tinggi (${totalViews} views) tetapi klik sangat rendah (${totalClicks} clicks). Penawaran harga/diskon kurang menarik bagi audiens.`,
        recommended_action: 'REVISE_PRICE_DISCOUNT_HOOK_OR_COOLING',
        can_stop: false,
        reasoning: 'Audiens melihat postingan tetapi tidak tergerak untuk mengklik link penawaran.'
      };

      await logAgentDecision({
        userId,
        decisionType: 'DIAGNOSTIC_ANALYSIS',
        productId,
        summary: 'Diagnosis: Offer Problem (Penawaran Kurang Memikat)',
        reasoning: result.reasoning,
        metadata: result
      });

      return result;
    }

    // 5. DIAGNOSIS 4: Product Problem (Semua Variasi Sudah Diuji & Gagal)
    // Jika sudah diuji >= 3 kali, di seluruh platform aktif, multi-angle/media, tapi total klik < 5
    if (history.length >= 3) {
      const result = {
        product_id: productId,
        diagnosis_category: 'PRODUCT_PROBLEM',
        finding: `Produk telah diuji ${history.length} kali melintasi platform aktif (${Array.from(platformsTested).join(', ') || 'aktif'}), berbagai sudut pandang (${Array.from(anglesTested).join(', ')}), dan jam berbeda, namun tetap menghasilkan respon rendah (Total ${totalClicks} klik).`,
        recommended_action: 'STOP_FOR_QUARTER',
        can_stop: true,
        reasoning: 'Semua hipotesis kreatif dan traffic telah diuji. Disarankan mengistirahatkan produk ini untuk kuartal berjalan agar slot jadwal dialihkan ke produk berpotensi tinggi.'
      };

      // Update status produk menjadi STOPPED
      await prodRef.update({
        lifecycle_status: 'STOPPED',
        quarterly_status: {
          status: 'stopped_for_quarter',
          stop_reason: result.finding,
          stopped_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      });

      await logAgentDecision({
        userId,
        decisionType: 'QUARTER_LIFECYCLE',
        productId,
        summary: 'Keputusan Kuartal: STOP Produk Ini untuk Kuartal Berjalan',
        reasoning: result.reasoning,
        metadata: result
      });

      return result;
    }

    return {
      product_id: productId,
      diagnosis_category: 'INSUFFICIENT_EXPERIMENTS',
      finding: `Produk baru diuji ${history.length} kali. Belum memenuhi syarat penarikan kesimpulan.`,
      recommended_action: 'CONTINUE_TESTING',
      can_stop: false
    };

  } catch (err) {
    console.error('[diagnoseProductPerformance Error]:', err.message);
    return { error: err.message };
  }
}

module.exports = {
  diagnoseProductPerformance,
};
