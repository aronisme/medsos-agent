const { db } = require('../../config/firebase');
const { logAgentDecision } = require('./decisionLogger');

/**
 * Mengambil daftar URL media yang sudah pernah digunakan pada platform atau akun tertentu untuk produk ini.
 * @param {Object} params
 * @param {string} params.productId
 * @param {string} [params.platform='all']
 * @param {string} [params.accountId]
 * @param {Object} [params.productObj]
 * @param {Set<string>|Array<string>} [params.inMemoryReservedUrls]
 * @param {string} [params.userId='system']
 * @returns {Promise<Set<string>>}
 */
async function getUsedMediaForPlatform(productId, platform = 'all', productObj = null, userId = 'system', accountId = null, inMemoryReservedUrls = null) {
  const usedUrls = new Set();
  if (!productId) return usedUrls;

  const cleanPlatform = String(platform || 'all').toLowerCase();
  const cleanAccountId = accountId ? String(accountId).trim() : null;

  // 0. Masukkan media yang sedang di-reserve secara real-time dalam siklus batch ini
  if (inMemoryReservedUrls) {
    const list = inMemoryReservedUrls instanceof Set ? Array.from(inMemoryReservedUrls) : inMemoryReservedUrls;
    if (Array.isArray(list)) {
      list.forEach(url => {
        if (url) usedUrls.add(String(url).trim());
      });
    }
  }

  // 1. Cek dari field cached di productObj jika ada (used_media_by_platform & used_media_by_account)
  if (productObj) {
    if (productObj.used_media_by_platform) {
      if (cleanPlatform === 'all') {
        Object.values(productObj.used_media_by_platform).forEach(list => {
          if (Array.isArray(list)) list.forEach(url => usedUrls.add(String(url).trim()));
        });
      } else {
        const platList = productObj.used_media_by_platform[cleanPlatform] || [];
        platList.forEach(url => usedUrls.add(String(url).trim()));
      }
    }

    if (cleanAccountId && productObj.used_media_by_account?.[cleanAccountId]) {
      const accList = productObj.used_media_by_account[cleanAccountId] || [];
      accList.forEach(url => usedUrls.add(String(url).trim()));
    }

    return usedUrls;
  }

  // 2. Query dari product_post_memory untuk platform / akun ini
  try {
    let query = db.collection('product_post_memory')
      .where('product_id', '==', String(productId));

    if (cleanPlatform !== 'all') {
      query = query.where('context_at_post.platform', '==', cleanPlatform);
    }

    const snap = await query.get();
    snap.docs.forEach(doc => {
      const data = doc.data();
      const mediaUrls = data?.context_at_post?.media_urls || [];
      mediaUrls.forEach(url => {
        if (url) usedUrls.add(String(url).trim());
      });
    });
  } catch (err) {
    console.warn('[getUsedMediaForPlatform Warning]:', err.message);
  }

  return usedUrls;
}

/**
 * Menandai media yang telah digunakan pada platform dan akun tertentu
 * @param {string} productId
 * @param {Array<string>} mediaUrls
 * @param {string} platform
 * @param {string} userId
 * @param {string} [accountId]
 */
async function markMediaUsedOnPlatform(productId, mediaUrls = [], platform = 'facebook', userId = 'system', accountId = null) {
  if (!productId || !Array.isArray(mediaUrls) || mediaUrls.length === 0) return;
  const cleanPlatform = String(platform || 'facebook').toLowerCase();
  const cleanAccountId = accountId ? String(accountId).trim() : null;

  try {
    const prodRef = db.collection('affiliate_products').doc(String(productId));
    const prodDoc = await prodRef.get();
    if (!prodDoc.exists) return;

    const prodData = prodDoc.data();
    
    // Platform-level usage
    const existingPlatformUsage = prodData.used_media_by_platform || {};
    const platformList = existingPlatformUsage[cleanPlatform] || [];
    const updatedPlatformList = Array.from(new Set([...platformList, ...mediaUrls.map(u => String(u).trim())]));
    existingPlatformUsage[cleanPlatform] = updatedPlatformList;

    // Account-level usage
    const existingAccountUsage = prodData.used_media_by_account || {};
    if (cleanAccountId) {
      const accountList = existingAccountUsage[cleanAccountId] || [];
      const updatedAccountList = Array.from(new Set([...accountList, ...mediaUrls.map(u => String(u).trim())]));
      existingAccountUsage[cleanAccountId] = updatedAccountList;
    }

    await prodRef.update({
      used_media_by_platform: existingPlatformUsage,
      used_media_by_account: existingAccountUsage,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('[markMediaUsedOnPlatform Warning]:', err.message);
  }
}

/**
 * Kurasi media produk Shopee dengan isolasi akun & platform + real-time reservation:
 * 1. Media yang SUDAH PERNAH digunakan pada platform target (misal FB) TIDAK BOLEH digunakan lagi pada platform tersebut.
 * 2. Media yang sudah di-reserve oleh akun lain pada siklus yang sama DIISOLASI secara real-time.
 * 3. Maksimal 2 Gambar Terbaik per post (clean, estetik) ATAU Maksimal 1 Video Terbaik per post.
 * 
 * @param {Object} product - Objek produk
 * @param {string} [preferredType] - 'image' | 'video' | 'auto' | 'none'
 * @param {string} [platform] - 'facebook' | 'threads' | 'instagram' | 'all'
 * @param {string} [userId]
 * @param {Object} [options] - { accountId, inMemoryReservedUrls, threadsMediaMode: 'auto'|'no_media'|'with_media', allowFallbackNoMedia: boolean }
 * @returns {Promise<Object>} { media_type: 'image'|'video'|'text'|null, selected_media: Array, no_fresh_media: boolean, reasoning: string }
 */
async function curateProductMedia(product, preferredType = 'auto', platform = 'all', userId = 'system', options = {}) {
  try {
    const { threadsMediaMode = 'auto', allowFallbackNoMedia = true, accountId = null, inMemoryReservedUrls = null } = options;
    const isThreads = platform === 'threads';

    // 0. Jika platform Threads secara eksplisit memilih mode no_media / preferredType = 'none'
    if (isThreads && (threadsMediaMode === 'no_media' || preferredType === 'none')) {
      const result = {
        media_type: 'text',
        selected_media: [],
        no_fresh_media: false,
        reasoning: 'Mode posting Teks + Link Card Preview (tanpa media foto/video) aktif untuk Threads.'
      };

      if (product.id) {
        await logAgentDecision({
          userId,
          decisionType: 'MEDIA_SELECTION',
          productId: product.id,
          summary: `Kurasi Media: Postingan Teks + Link Preview (Tanpa Media) untuk THREADS`,
          reasoning: result.reasoning,
          metadata: { platform, threads_media_mode: 'no_media' }
        });
      }

      return result;
    }

    const rawImages = Array.isArray(product.images) ? product.images : [];
    const rawVideos = Array.isArray(product.videos) ? product.videos : [];
    const rawMediaList = Array.isArray(product.media) ? product.media : [];

    // Extract all image and video URLs
    const allImageList = [];
    const allVideoList = [];

    // Process rawMediaList
    rawMediaList.forEach(m => {
      if (m?.type === 'video' && m.url) allVideoList.push(m.url);
      else if (m?.type === 'image' && m.url) allImageList.push(m.url);
    });

    // Merge with rawImages & rawVideos
    rawVideos.forEach(v => {
      const url = typeof v === 'string' ? v : v?.url;
      if (url && !allVideoList.includes(url)) allVideoList.push(url);
    });

    rawImages.forEach(img => {
      const url = typeof img === 'string' ? img : img?.url;
      if (url && !allImageList.includes(url)) allImageList.push(url);
    });

    // Ambil media yang sudah pernah digunakan khusus pada PLATFORM dan AKUN ini (termasuk in-memory reservation)
    const usedMediaSet = await getUsedMediaForPlatform(product.id, platform, product, userId, accountId, inMemoryReservedUrls);

    // Filter HANYA media yang BELUM pernah dipakai di platform ini (Fresh Media)
    const freshVideoList = allVideoList.filter(url => !usedMediaSet.has(String(url).trim()));
    const freshImageList = allImageList.filter(url => !usedMediaSet.has(String(url).trim()) && typeof url === 'string' && url.startsWith('http'));

    const platformLabel = platform !== 'all' ? platform.toUpperCase() : 'SEMUA PLATFORM';

    // 1. Keputusan Pemilihan Video (Max 1 Video Segar)
    if ((preferredType === 'video' || (preferredType === 'auto' && freshVideoList.length > 0)) && freshVideoList.length > 0) {
      const selectedVideo = freshVideoList[0];
      const result = {
        media_type: 'video',
        selected_media: [{ url: selectedVideo, type: 'video' }],
        no_fresh_media: false,
        reasoning: `Memilih 1 video segar untuk [${platformLabel}] (${freshVideoList.length} video baru tersedia, ${allVideoList.length - freshVideoList.length} video lama sudah pernah digunakan di ${platformLabel}).`
      };

      if (product.id) {
        await logAgentDecision({
          userId,
          decisionType: 'MEDIA_SELECTION',
          productId: product.id,
          summary: `Kurasi Media: 1 Video Demo Segar untuk ${platformLabel}`,
          reasoning: result.reasoning,
          metadata: { video_url: selectedVideo, platform, fresh_videos: freshVideoList.length }
        });
      }

      return result;
    }

    // 2. Keputusan Pemilihan Gambar (Max 2 Gambar Segar)
    let selectedImages = [];
    let reasoning = '';

    if (freshImageList.length === 0) {
      // Jika semua gambar & video sudah habis terpakai pada platform ini
      // Khusus Threads: Fallback mulus ke mode Teks + Link Card Preview jika diizinkan
      if (isThreads && allowFallbackNoMedia && threadsMediaMode !== 'with_media') {
        const result = {
          media_type: 'text',
          selected_media: [],
          no_fresh_media: false,
          is_no_media_fallback: true,
          reasoning: `Media visual produk (${allImageList.length} foto, ${allVideoList.length} video) sudah pernah digunakan di [THREADS]. Beralih otomatis ke mode Teks + Link Card Preview tanpa media.`
        };

        if (product.id) {
          await logAgentDecision({
            userId,
            decisionType: 'MEDIA_SELECTION',
            productId: product.id,
            summary: `Kurasi Media: Fallback Otomatis ke Link Card Preview (Tanpa Media) untuk THREADS`,
            reasoning: result.reasoning,
            metadata: { platform, used_count: usedMediaSet.size, fallback_to_no_media: true }
          });
        }

        return result;
      }

      const result = {
        media_type: null,
        selected_media: [],
        no_fresh_media: true,
        reasoning: `Semua media produk (${allImageList.length} foto, ${allVideoList.length} video) sudah pernah diposting di [${platformLabel}]. Produk memerlukan media baru untuk platform ini.`
      };

      if (product.id) {
        await logAgentDecision({
          userId,
          decisionType: 'MEDIA_SELECTION',
          productId: product.id,
          summary: `Kurasi Media Ditolak: Tidak ada media baru untuk ${platformLabel}`,
          reasoning: result.reasoning,
          metadata: { platform, used_count: usedMediaSet.size }
        });
      }

      return result;
    } else if (freshImageList.length === 1) {
      selectedImages = [freshImageList[0]];
      reasoning = `Memilih 1-satunya foto produk segar yang belum pernah dipakai di [${platformLabel}].`;
    } else {
      selectedImages = [freshImageList[0], freshImageList[1]];
      reasoning = `Memilih 2 foto produk segar dari ${freshImageList.length} foto yang belum pernah dipakai di [${platformLabel}] (${allImageList.length - freshImageList.length} foto lama dieliminasi).`;
    }

    const formattedSelected = selectedImages.map((url, idx) => ({
      url,
      type: 'image',
      sort_order: idx
    }));

    const result = {
      media_type: 'image',
      selected_media: formattedSelected,
      no_fresh_media: false,
      reasoning
    };

    if (product.id) {
      await logAgentDecision({
        userId,
        decisionType: 'MEDIA_SELECTION',
        productId: product.id,
        summary: `Kurasi Media: ${formattedSelected.length} Foto Segar untuk ${platformLabel} (Maksimal 2)`,
        reasoning,
        metadata: { selected_count: formattedSelected.length, fresh_images: freshImageList.length, platform }
      });
    }

    return result;
  } catch (err) {
    console.error('[curateProductMedia Error]:', err.message);
    return {
      media_type: 'image',
      selected_media: [],
      no_fresh_media: false,
      reasoning: `Error kurasi media: ${err.message}`
    };
  }
}

/**
 * Menghitung ringkasan kesehatan media produk (sisa media segar per platform)
 * Digunakan secara terpusat oleh REST API katalog produk dan antarmuka UI.
 * @param {Object} product
 * @returns {Object}
 */
function calculateProductMediaHealth(product = {}) {
  const rawImages = Array.isArray(product.images) ? product.images : [];
  const rawVideos = Array.isArray(product.videos) ? product.videos : [];
  const rawMediaList = Array.isArray(product.media) ? product.media : [];

  const allImageList = [];
  const allVideoList = [];

  rawMediaList.forEach(m => {
    if (m?.type === 'video' && m.url && !allVideoList.includes(m.url)) allVideoList.push(m.url);
    else if (m?.type === 'image' && m.url && !allImageList.includes(m.url)) allImageList.push(m.url);
  });

  rawVideos.forEach(v => {
    const url = typeof v === 'string' ? v : v?.url;
    if (url && !allVideoList.includes(url)) allVideoList.push(url);
  });

  rawImages.forEach(img => {
    const url = typeof img === 'string' ? img : img?.url;
    if (url && !allImageList.includes(url)) allImageList.push(url);
  });

  const usedByPlatform = product.used_media_by_platform || {};

  const platforms = ['facebook', 'threads'];
  const summary = {};

  platforms.forEach(platform => {
    const usedList = Array.isArray(usedByPlatform[platform]) ? usedByPlatform[platform] : [];
    const usedSet = new Set(usedList.map(u => String(u).trim()));

    const freshImages = allImageList.filter(url => !usedSet.has(String(url).trim())).length;
    const freshVideos = allVideoList.filter(url => !usedSet.has(String(url).trim())).length;
    const canPost = (freshVideos >= 1 || freshImages >= 1 || platform === 'threads');

    let status = 'healthy';
    if (freshVideos === 0 && freshImages === 0) {
      status = platform === 'threads' ? 'link_preview_ready' : 'exhausted';
    } else if (freshImages <= 1 && freshVideos === 0) {
      status = 'warning';
    }

    summary[platform] = {
      total_images: allImageList.length,
      total_videos: allVideoList.length,
      fresh_images: freshImages,
      fresh_videos: freshVideos,
      can_post: canPost,
      can_post_no_media: platform === 'threads',
      status
    };
  });

  return summary;
}

module.exports = {
  curateProductMedia,
  getUsedMediaForPlatform,
  markMediaUsedOnPlatform,
  calculateProductMediaHealth,
};

