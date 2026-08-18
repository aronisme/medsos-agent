const crypto = require('crypto');

/**
 * Stopwords dasar bahasa Indonesia & simbol untuk ekstraksi token murni
 */
const STOPWORDS = new Set([
  'yang', 'untuk', 'pada', 'ke', 'para', 'namun', 'menurut', 'antara', 'dia', 'dua',
  'ia', 'seperti', 'jika', 'sehingga', 'kembali', 'dan', 'ini', 'karena', 'oleh',
  'saat', 'harus', 'sementara', 'setelah', 'belum', 'kami', 'sekitar', 'bagi',
  'serta', 'di', 'dari', 'dengan', 'ada', 'bisa', 'akan', 'sudah', 'atau', 'kamu',
  'aku', 'kalian', 'mereka', 'kita', 'buat', 'dalam', 'jadi', 'aja', 'ya', 'banget',
  'deh', 'nih', 'dong', 'yuk', 'cek', 'link', 'bio', 'klik', 'promo', 'shopee'
]);

/**
 * Ekstraksi token kata kunci penting dari teks
 * @param {string} text
 * @returns {Set<string>}
 */
function extractCoreTokens(text = '') {
  if (!text) return new Set();
  const cleaned = String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned.split(' ');
  const tokenSet = new Set();

  words.forEach(w => {
    if (w.length >= 3 && !STOPWORDS.has(w)) {
      tokenSet.add(w);
    }
  });

  return tokenSet;
}

/**
 * Menghitung Content Fingerprint Hash
 * @param {Object} opts
 * @param {string} opts.productId
 * @param {string} opts.hookText
 * @param {string} [opts.captionText]
 * @param {string} [opts.mediaUrl]
 * @returns {string} Fingerprint hash string
 */
function generateContentFingerprint({ productId, hookText, captionText = '', mediaUrl = '' }) {
  const combined = `${productId}__${hookText}__${captionText.slice(0, 100)}__${mediaUrl}`;
  return 'fp_' + crypto.createHash('sha256').update(combined).digest('hex').substring(0, 16);
}

/**
 * Menghitung character 3-gram set dari teks
 */
function extractNGrams(text = '', n = 3) {
  const cleaned = String(text).toLowerCase().replace(/\s+/g, ' ').trim();
  const ngrams = new Set();
  if (cleaned.length < n) {
    if (cleaned.length > 0) ngrams.add(cleaned);
    return ngrams;
  }
  for (let i = 0; i <= cleaned.length - n; i++) {
    ngrams.add(cleaned.substring(i, i + n));
  }
  return ngrams;
}

/**
 * Menghitung derajat kemiripan token Jaccard & N-gram Similarity (0.0 - 1.0)
 * @param {string} textA 
 * @param {string} textB 
 * @returns {number} 0.0 sampai 1.0
 */
function calculateTokenSimilarity(textA, textB) {
  const tokensA = extractCoreTokens(textA);
  const tokensB = extractCoreTokens(textB);

  // 1. Word Token Jaccard
  let tokenSim = 0;
  if (tokensA.size > 0 && tokensB.size > 0) {
    let intersectionCount = 0;
    tokensA.forEach(t => {
      if (tokensB.has(t)) intersectionCount++;
    });
    const unionCount = new Set([...tokensA, ...tokensB]).size;
    tokenSim = unionCount > 0 ? intersectionCount / unionCount : 0;
  }

  // 2. Character N-Gram Jaccard
  const ngramsA = extractNGrams(textA, 3);
  const ngramsB = extractNGrams(textB, 3);
  let ngramSim = 0;
  if (ngramsA.size > 0 && ngramsB.size > 0) {
    let nIntersection = 0;
    ngramsA.forEach(g => {
      if (ngramsB.has(g)) nIntersection++;
    });
    const nUnion = new Set([...ngramsA, ...ngramsB]).size;
    ngramSim = nUnion > 0 ? nIntersection / nUnion : 0;
  }

  // Kombinasi berbobot: 60% Word Token + 40% N-Gram
  return (tokenSim * 0.6) + (ngramSim * 0.4);
}


/**
 * Memeriksa apakah draf konten baru terlalu mirip (>65%) dengan postingan 7 hari terakhir
 * @param {Object} newDraft - { caption, hook_text, product_id, platform }
 * @param {Array} recentPosts - list of recent posts on same platform from product_post_memory
 * @param {number} threshold - threshold kemiripan (default 0.65 atau 65%)
 * @returns {Object} { is_duplicate: boolean, highest_similarity: number, conflicting_post: Object|null }
 */
function checkContentSimilarity(newDraft, recentPosts = [], threshold = 0.65) {

  const newCaption = newDraft.caption || newDraft.content || '';
  const newHook = newDraft.hook_text || '';
  const newText = `${newHook} ${newCaption}`;

  let highestSim = 0;
  let conflictingPost = null;

  for (const post of recentPosts) {
    // Jika produknya sama atau angle-nya mirip, uji kemiripannya
    const pastCaption = post.context_at_post?.caption_preview || post.raw_metrics?.caption || '';
    const pastHook = post.context_at_post?.hook_type || '';
    const pastText = `${pastHook} ${pastCaption}`;

    const sim = calculateTokenSimilarity(newText, pastText);
    if (sim > highestSim) {
      highestSim = sim;
      conflictingPost = post;
    }
  }

  const isDuplicate = highestSim >= threshold;

  return {
    is_duplicate: isDuplicate,
    highest_similarity: Number((highestSim * 100).toFixed(1)),
    conflicting_post: isDuplicate ? conflictingPost : null,
    similarity_score: Number(highestSim.toFixed(3)),
  };
}

module.exports = {
  generateContentFingerprint,
  calculateTokenSimilarity,
  checkContentSimilarity,
};
