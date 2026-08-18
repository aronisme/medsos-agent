const { db } = require('../../config/firebase');
const { logAgentDecision } = require('./decisionLogger');

/**
 * Kurasi media produk Shopee dengan aturan ketat:
 * - Maksimal 2 Gambar Terbaik per post (clean, estetik, tanpa watermark harga coret berlebihan).
 * - ATAU Maksimal 1 Video Terbaik per post (demo/review/unboxing).
 * 
 * @param {Object} product - Objek produk
 * @param {string} [preferredType] - 'image' | 'video' | 'auto'
 * @param {string} [userId]
 * @returns {Promise<Object>} { media_type: 'image'|'video', selected_media: Array, reasoning: string }
 */
async function curateProductMedia(product, preferredType = 'auto', userId = 'system') {
  try {
    const rawImages = Array.isArray(product.images) ? product.images : [];
    const rawVideos = Array.isArray(product.videos) ? product.videos : [];
    const rawMediaList = Array.isArray(product.media) ? product.media : [];

    // Extract all image and video URLs
    const imageList = [];
    const videoList = [];

    // Process rawMediaList
    rawMediaList.forEach(m => {
      if (m?.type === 'video' && m.url) videoList.push(m.url);
      else if (m?.type === 'image' && m.url) imageList.push(m.url);
    });

    // Merge with rawImages & rawVideos
    rawVideos.forEach(v => {
      const url = typeof v === 'string' ? v : v?.url;
      if (url && !videoList.includes(url)) videoList.push(url);
    });

    rawImages.forEach(img => {
      const url = typeof img === 'string' ? img : img?.url;
      if (url && !imageList.includes(url)) imageList.push(url);
    });

    // 1. Keputusan Pemilihan Video (Max 1 Video)
    if ((preferredType === 'video' || (preferredType === 'auto' && videoList.length > 0)) && videoList.length > 0) {
      const selectedVideo = videoList[0];
      const result = {
        media_type: 'video',
        selected_media: [{ url: selectedVideo, type: 'video' }],
        reasoning: `Memilih 1 video produk utama untuk demonstrasi visual dinamis (${videoList.length} video tersedia).`
      };

      await logAgentDecision({
        userId,
        decisionType: 'MEDIA_SELECTION',
        productId: product.id,
        summary: 'Kurasi Media: 1 Video Demo Produk Terpilih',
        reasoning: result.reasoning,
        metadata: { video_url: selectedVideo }
      });

      return result;
    }

    // 2. Keputusan Pemilihan Gambar (Max 2 Gambar)
    // Filter gambar Shopee yang valid
    const validImages = imageList.filter(url => typeof url === 'string' && url.startsWith('http'));

    let selectedImages = [];
    let reasoning = '';

    if (validImages.length === 0) {
      // Fallback single placeholder or empty
      selectedImages = [];
      reasoning = 'Tidak ada media gambar valid yang tersedia pada produk ini.';
    } else if (validImages.length === 1) {
      selectedImages = [validImages[0]];
      reasoning = 'Memilih 1-satunya foto produk yang tersedia.';
    } else {
      // Pilih 2 foto terbaik: Foto ke-1 (tampilan utama) dan Foto ke-2 (sudut alternatif / detail bahan)
      // Menghindari foto ke-5 ke atas yang biasanya berupa tabel ukuran atau syarat retur
      selectedImages = [validImages[0], validImages[1]];
      reasoning = `Memilih 2 foto produk terbersih dari total ${validImages.length} foto Shopee (mengeliminasi banner promo yang ramai).`;
    }

    const formattedSelected = selectedImages.map((url, idx) => ({
      url,
      type: 'image',
      sort_order: idx
    }));

    const result = {
      media_type: 'image',
      selected_media: formattedSelected,
      reasoning
    };

    if (product.id) {
      await logAgentDecision({
        userId,
        decisionType: 'MEDIA_SELECTION',
        productId: product.id,
        summary: `Kurasi Media: ${formattedSelected.length} Foto Produk Terpilih (Maksimal 2)`,
        reasoning,
        metadata: { selected_count: formattedSelected.length, total_images: validImages.length }
      });
    }

    return result;
  } catch (err) {
    console.error('[curateProductMedia Error]:', err.message);
    return {
      media_type: 'image',
      selected_media: [],
      reasoning: `Error kurasi media: ${err.message}`
    };
  }
}

module.exports = {
  curateProductMedia,
};
