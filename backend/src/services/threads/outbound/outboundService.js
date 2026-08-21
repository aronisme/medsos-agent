const { db } = require('../../../config/firebase');
const { searchPosts } = require('../api/threadsSearchApi');
const { getNextKeywordsForSearch, markKeywordSearched } = require('./searchScheduler');
const { matchProductToPublicPost } = require('../products/productMatcher');
const { createCandidate } = require('./candidateService');

/**
 * Menjalankan siklus Social Listening Outbound untuk mencari calon pembeli
 * @param {string} userId - ID User
 */
async function runOutboundSocialListening(userId) {
  const summary = { searchedKeywords: 0, foundPosts: 0, candidatesCreated: 0 };

  try {
    // 1. Ambil akun Threads aktif milik pengguna untuk token pencarian
    const accountsSnap = await db.collection('social_accounts')
      .where('user_id', '==', userId)
      .where('platform', '==', 'threads')
      .where('is_active', 'in', [1, true, '1'])
      .limit(1)
      .get();

    if (accountsSnap.empty) return summary;
    const account = { id: accountsSnap.docs[0].id, ...accountsSnap.docs[0].data() };
    const token = account.access_token;
    if (!token) return summary;

    // 2. Ambil katalog produk aktif milik pengguna
    const productsSnap = await db.collection('affiliate_products')
      .where('user_id', '==', userId)
      .get();

    const products = productsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.is_active !== false && p.lifecycle_status !== 'STOPPED' && (p.product_url || p.affiliate_link));

    if (products.length === 0) {
      console.log('[OutboundService] Tidak ada produk aktif di katalog untuk dipasangkan.');
      return summary;
    }

    // 3. Ambil batch kata kunci yang siap dicari
    const keywords = await getNextKeywordsForSearch(userId, 3);

    for (const kwObj of keywords) {
      try {
        summary.searchedKeywords++;
        const searchRes = await searchPosts(token, kwObj.keyword, { limit: 10, searchType: 'RECENT' });
        const posts = searchRes.data || [];
        summary.foundPosts += posts.length;

        for (const p of posts) {
          // Abaikan jika postingan berasal dari akun kita sendiri
          if (p.username && p.username.toLowerCase() === (account.page_name || '').toLowerCase()) {
            continue;
          }

          // Cocokkan teks postingan dengan katalog produk
          const match = matchProductToPublicPost(p.text, products);

          // Masukkan ke antrean kandidat jika niat beli & relevansi memadai
          if (match.matchedProduct && match.buyingIntentScore >= 0.70 && match.relevanceScore >= 0.50) {
            const candRes = await createCandidate({
              userId,
              accountId: account.id,
              threadId: p.id,
              authorId: p.id,
              authorUsername: p.username || '',
              postText: p.text || '',
              postTimestamp: p.timestamp || new Date().toISOString(),
              keyword: kwObj.keyword,
              buyingIntentScore: match.buyingIntentScore,
              relevanceScore: match.relevanceScore,
              matchedProductId: match.matchedProduct.id,
              matchedProductTitle: match.matchedProduct.title,
              replyTemplateStyle: 'helpful',
              replyTextDraft: `Halo kak, kalau cari ${match.matchedProduct.title?.slice(0, 30)}, ini rekomendasi yang bagus:`,
            });

            if (candRes?.created) {
              summary.candidatesCreated++;
            }
          }
        }

        await markKeywordSearched(kwObj.id);
      } catch (searchErr) {
        console.warn(`[OutboundService] Warning searching keyword "${kwObj.keyword}":`, searchErr.message);
      }
    }
  } catch (err) {
    console.error('[OutboundService] Fatal error in social listening cycle:', err.message);
  }

  return summary;
}

module.exports = {
  runOutboundSocialListening,
};
