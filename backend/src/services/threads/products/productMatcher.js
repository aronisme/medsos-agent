const { LINK_REQUEST_PATTERNS } = require('../inbound/intentClassifier');

/**
 * Menghitung skor niat beli (Buying Intent Score) dari teks postingan
 * @param {string} text 
 * @returns {number} 0.0 - 1.0
 */
function calculateBuyingIntent(text = '') {
  const clean = String(text || '').toLowerCase();
  if (!clean) return 0;

  let score = 0.15;

  // 1. Cek pola permintaan eksplisit
  for (const pattern of LINK_REQUEST_PATTERNS) {
    if (pattern.test(clean)) {
      score += 0.55;
      break;
    }
  }

  // 2. Kata kunci niat beli kuat
  const highIntentKeywords = ['rekomendasi', 'rekomen', 'recomended', 'spill', 'beli', 'cari', 'diskon', 'murah', 'olshop', 'shopee'];
  for (const kw of highIntentKeywords) {
    if (clean.includes(kw)) {
      score += 0.25;
    }
  }

  // 3. Konteks kebutuhan
  const contextKeywords = ['buat', 'untuk', 'bagus', 'worth it', 'adem', 'lucu', 'nyari', 'butuh'];
  for (const cw of contextKeywords) {
    if (clean.includes(cw)) {
      score += 0.10;
    }
  }

  // 4. Tanda tanya menunjukkan pertanyaan
  if (clean.includes('?')) {
    score += 0.15;
  }

  return Math.min(Math.round(score * 100) / 100, 0.98);
}

/**
 * Mencocokkan teks postingan publik dengan katalog produk yang aktif
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
    const desc = String(prod.description || '').toLowerCase();

    // 1. Title Token Overlap
    const titleWords = title.split(/\s+/).filter(w => w.length > 2);
    let matchedWords = 0;
    for (const w of titleWords) {
      if (cleanText.includes(w)) matchedWords++;
    }
    if (titleWords.length > 0) {
      score += (matchedWords / titleWords.length) * 0.6;
    }

    // 2. Category Match
    if (category && cleanText.includes(category)) {
      score += 0.3;
    }

    // 3. Description keyword match
    if (desc) {
      const descWords = desc.split(/\s+/).slice(0, 30).filter(w => w.length > 3);
      for (const dw of descWords) {
        if (cleanText.includes(dw)) {
          score += 0.05;
          break;
        }
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
};
