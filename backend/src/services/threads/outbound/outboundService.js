const { db } = require('../../../config/firebase');
const { searchPosts } = require('../api/threadsSearchApi');
const { getNextKeywordsForSearch, markKeywordSearched } = require('./searchScheduler');
const { matchProductToPublicPost } = require('../products/productMatcher');
const { createCandidate } = require('./candidateService');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Menjalankan siklus Social Listening Outbound untuk mencari calon pembeli di Threads
 * Dilengkapi Multi-Account Token Fallback jika salah satu akun belum memiliki scope search
 * @param {string} userId - ID User
 */
async function runOutboundSocialListening(userId) {
  const summary = { searchedKeywords: 0, foundPosts: 0, candidatesCreated: 0 };

  try {
    // 1. Ambil seluruh akun Threads aktif milik pengguna
    const accountsSnap = await db.collection('social_accounts')
      .where('user_id', '==', userId)
      .where('platform', '==', 'threads')
      .where('is_active', 'in', [1, true, '1'])
      .get();

    if (accountsSnap.empty) {
      console.log(`[OutboundService] Tidak ada akun Threads aktif untuk user ${userId}`);
      return summary;
    }

    const threadsAccounts = accountsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Himpun seluruh username/handle akun milik pengguna untuk menghindari matching postingan sendiri
    const ownedUsernames = new Set();
    threadsAccounts.forEach(acc => {
      if (acc.page_name) ownedUsernames.add(acc.page_name.toLowerCase().trim());
      if (acc.username) ownedUsernames.add(acc.username.toLowerCase().trim());
      if (acc.name) ownedUsernames.add(acc.name.toLowerCase().trim());
      if (acc.page_id) ownedUsernames.add(String(acc.page_id).trim());
    });

    // 2. Ambil katalog produk aktif milik pengguna
    const productsSnap = await db.collection('affiliate_products')
      .where('user_id', '==', userId)
      .get();

    const products = productsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.is_active !== false && p.lifecycle_status !== 'STOPPED' && (p.product_url || p.affiliate_link || p.link));

    if (products.length === 0) {
      console.log('[OutboundService] Tidak ada produk aktif di katalog untuk dipasangkan.');
      return summary;
    }

    // 3. Ambil batch kata kunci yang siap dicari
    const keywords = await getNextKeywordsForSearch(userId, 3);

    for (let i = 0; i < keywords.length; i++) {
      const kwObj = keywords[i];
      try {
        summary.searchedKeywords++;
        const rawKw = String(kwObj.keyword || '').trim();
        if (!rawKw) continue;

        let searchRes = null;
        let workingAccount = null;

        // Multi-Account Token Fallback: coba akun Threads aktif yang memiliki token valid
        for (const acc of threadsAccounts) {
          if (!acc.access_token) continue;
          try {
            searchRes = await searchPosts(acc.access_token, rawKw, { limit: 5, searchType: 'RECENT' });
            if (searchRes && Array.isArray(searchRes.data)) {
              workingAccount = acc;
              break; // Token berhasil mengambil data
            }
          } catch (accSearchErr) {
            // Lanjut mencoba akun Threads aktif berikutnya
            continue;
          }
        }

        if (!searchRes || !workingAccount) {
          console.warn(`[OutboundService] Seluruh akun Threads gagal mencari keyword "${rawKw}"`);
          await markKeywordSearched(kwObj.id);
          continue;
        }

        const posts = searchRes.data || [];
        summary.foundPosts += posts.length;

        for (const p of posts) {
          const authorUser = String(p.username || '').toLowerCase().trim();

          // Abaikan jika postingan berasal dari salah satu akun Threads milik pengguna sendiri
          if (authorUser && ownedUsernames.has(authorUser)) {
            continue;
          }

          // Abaikan jika teks postingan kosong
          if (!p.text || !p.text.trim()) continue;

          // Cocokkan teks postingan publik dengan katalog produk
          const match = matchProductToPublicPost(p.text, products);

          // Kriteria lolos kandidat: Niat beli >= 0.60 dan Relevansi >= 0.25
          if (match.matchedProduct && match.buyingIntentScore >= 0.60 && match.relevanceScore >= 0.25) {
            const candRes = await createCandidate({
              userId,
              accountId: workingAccount.id,
              threadId: p.id,
              authorId: p.id,
              authorUsername: p.username || 'user_threads',
              postText: p.text || '',
              postTimestamp: p.timestamp || new Date().toISOString(),
              keyword: rawKw,
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

        if (i < keywords.length - 1) {
          await delay(1200);
        }
      } catch (searchErr) {
        console.warn(`[OutboundService] Warning searching keyword "${kwObj.keyword}":`, searchErr.message);
        await markKeywordSearched(kwObj.id);
        if (i < keywords.length - 1) {
          await delay(1200);
        }
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
