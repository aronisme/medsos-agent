const { get } = require('./threadsApiClient');

/**
 * Membersihkan dan mengekstrak kata kunci pencarian tunggal yang optimal untuk Meta Threads API
 * Meta API v1.0 mewajibkan query pencarian tunggal / tanpa multi-word frasa kompleks
 */
function sanitizeSearchQuery(query = '') {
  const clean = String(query || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .trim();

  const ignoreWords = new Set([
    'rekomendasi', 'recomended', 'cari', 'nyari', 'butuh', 'info', 'toko',
    'link', 'olshop', 'scraped', 'haul', 'baju', 'wanita', 'pria'
  ]);

  const words = clean.split(/\s+/).filter(w => w.length >= 3);
  const coreWords = words.filter(w => !ignoreWords.has(w));

  if (coreWords.length > 0) {
    return coreWords[0];
  }
  return words[0] || 'shopee';
}

/**
 * Mencari postingan publik di Threads berdasarkan kata kunci
 * @param {string} token - User Access Token
 * @param {string} query - Kata kunci pencarian
 * @param {Object} [options] - { searchType: 'RECENT'|'TOP', limit: number, fields: string }
 */
async function searchPosts(token, query, options = {}) {
  if (!query || !String(query).trim()) {
    throw new Error('Query pencarian tidak boleh kosong.');
  }

  const {
    searchType = 'RECENT',
    limit = 5,
    fields = 'id,text,permalink,timestamp,username',
  } = options;

  const targetTerm = sanitizeSearchQuery(query);

  const params = {
    q: targetTerm,
    search_type: searchType,
    limit: Math.min(limit, 5),
    fields,
  };

  try {
    const res = await get('keyword_search', token, params);
    return res;
  } catch (err) {
    console.warn(`[threadsSearchApi] Gagal mencari "${targetTerm}":`, err.message);
    // Fallback darurat ke query umum 'shopee' atau 'spill' jika term spesifik ditolak
    if (targetTerm !== 'shopee' && targetTerm !== 'spill') {
      try {
        console.log(`[threadsSearchApi] Fallback ke keyword umum 'spill'...`);
        return await get('keyword_search', token, { ...params, q: 'spill' });
      } catch (_) {}
    }
    throw err;
  }
}

module.exports = {
  searchPosts,
  sanitizeSearchQuery,
};
