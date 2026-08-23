const { LINK_REQUEST_PATTERNS } = require('../inbound/intentClassifier');

const STOPWORDS = new Set([
  'dan', 'yang', 'untuk', 'pada', 'ke', 'para', 'namun', 'antara', 'dia', 'ia',
  'seperti', 'jika', 'kembali', 'ini', 'karena', 'oleh', 'saat', 'harus', 'sementara',
  'setelah', 'belum', 'kami', 'sekitar', 'bagi', 'serta', 'di', 'dari', 'dengan',
  'ada', 'bisa', 'akan', 'sudah', 'atau', 'kamu', 'aku', 'kalian', 'mereka', 'kita',
  'buat', 'dalam', 'jadi', 'aja', 'ya', 'banget', 'deh', 'nih', 'dong', 'yuk',
  'original', 'termurah', 'terlaris', 'promo', 'diskon', 'gratis', 'ongkir',
  'premium', 'import', 'lokal', 'kualitas', 'super', 'bagus', 'murah', 'ready',
  'stock', 'cod', 'indonesia', 'shop', 'store', 'official', 'star', 'seller'
]);

/**
 * Ekstraksi kata kunci utama produk dari judul
 */
function extractProductKeywords(title = '') {
  const words = String(title || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w));
  return Array.from(new Set(words));
}

/**
 * Menghitung skor niat beli (Buying Intent Score) dari teks postingan
 * @param {string} text 
 * @returns {number} 0.0 - 1.0
 */
function calculateBuyingIntent(text = '') {
  const clean = String(text || '').toLowerCase();
  if (!clean) return 0;

  let score = 0.25;

  // 1. Cek pola permintaan link eksplisit (spill, link, toko, beli dimana)
  for (const pattern of LINK_REQUEST_PATTERNS) {
    if (pattern.test(clean)) {
      score += 0.50;
      break;
    }
  }

  // 2. Kata kunci niat belanja kuat
  const highIntentKeywords = [
    'rekomendasi', 'rekomen', 'recomended', 'spill', 'beli', 'cari', 'nyari',
    'butuh', 'diskon', 'murah', 'olshop', 'shopee', 'racun', 'checkout',
    'haul', 'outfit', 'ootd', 'kondangan', 'kuliah', 'kerja'
  ];
  let matchedKwCount = 0;
  for (const kw of highIntentKeywords) {
    if (clean.includes(kw)) {
      matchedKwCount++;
    }
  }
  score += Math.min(matchedKwCount * 0.15, 0.40);

  // 3. Konteks kebutuhan & deskripsi positif
  const contextKeywords = ['buat', 'untuk', 'bagus', 'worth it', 'adem', 'lucu', 'gemas', 'estetik', 'cantik', 'kece'];
  for (const cw of contextKeywords) {
    if (clean.includes(cw)) {
      score += 0.08;
      break;
    }
  }

  // 4. Tanda tanya menunjukkan pertanyaan pencarian
  if (clean.includes('?')) {
    score += 0.10;
  }

  return Math.min(Math.round(score * 100) / 100, 0.99);
}

/**
 * Mencocokkan teks postingan publik dengan katalog produk yang aktif
 * Menggunakan Core Keyword Density & Niche Relevance
 * @param {string} postText 
 * @param {Array<Object>} products - Daftar produk dari collection affiliate_products
 * @returns {{ matchedProduct: Object|null, buyingIntentScore: number, relevanceScore: number }}
 */
function matchProductToPublicPost(postText = '', products = []) {
  const cleanText = String(postText || '').toLowerCase();
  const buyingIntentScore = calculateBuyingIntent(cleanText);

  if (!Array.isArray(products) || products.length === 0) {
    return { matchedProduct: null, buyingIntentScore, relevanceScore: 0 };
  }

  let bestProduct = null;
  let highestRelevance = 0;

  for (const prod of products) {
    // Validasi dasar
    if (prod.lifecycle_status === 'STOPPED' || prod.is_active === false) continue;
    const url = prod.product_url || prod.affiliate_link || prod.link;
    if (!url) continue;

    let score = 0;
    const title = String(prod.title || '').toLowerCase();
    const category = String(prod.category || '').toLowerCase();
    const niche = String(prod.agent_profile?.niche || '').toLowerCase();

    // 1. Ekstraksi kata kunci utama produk (Core Product Keywords)
    const productKeywords = extractProductKeywords(title);
    let matchedKeywords = 0;
    for (const kw of productKeywords) {
      if (cleanText.includes(kw)) {
        matchedKeywords++;
      }
    }

    if (matchedKeywords > 0) {
      // 1 kata cocok = +0.40, 2 kata = +0.65, 3+ kata = +0.80
      score += Math.min(matchedKeywords * 0.35, 0.80);
    }

    // 2. Category & Niche Match
    if (category && category !== 'umum' && cleanText.includes(category)) {
      score += 0.30;
    }
    if (niche && niche !== 'universal' && cleanText.includes(niche)) {
      score += 0.25;
    }

    // 3. Generic Shopping Context Match jika ada niat belanja tinggi
    if (score === 0 && buyingIntentScore >= 0.75) {
      // Jika tweet berupa pencarian belanja umum (misal: "racun shopee hari ini"), berikan baseline match untuk produk unggulan
      if (prod.lifecycle_status === 'PROVEN' || prod.lifecycle_status === 'PROMISING') {
        score = 0.35;
      } else {
        score = 0.25;
      }
    }

    // Normalisasi skor (0.0 - 1.0)
    score = Math.min(Math.round(score * 100) / 100, 0.99);

    if (score > highestRelevance) {
      highestRelevance = score;
      bestProduct = prod;
    }
  }

  return {
    matchedProduct: bestProduct,
    buyingIntentScore,
    relevanceScore: highestRelevance,
  };
}

module.exports = {
  calculateBuyingIntent,
  matchProductToPublicPost,
  extractProductKeywords,
};
