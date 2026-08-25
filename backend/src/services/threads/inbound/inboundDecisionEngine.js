const { db } = require('../../../config/firebase');
const { get } = require('../api/threadsApiClient');
const { classifyCommentIntent } = require('./intentClassifier');
const { evaluateCompliance } = require('../safety/complianceEngine');
const { dispatchReply } = require('../publishing/replyDispatcher');
const { matchProductToPublicPost } = require('../products/productMatcher');

/**
 * Mencari context produk untuk sebuah postingan Threads dengan multi-tier fallback
 * @returns {Promise<{ productId: string|null, productTitle: string, caption: string }>}
 */
async function resolveThreadProductContext(threadId, account, userId) {
  const ctxRef = db.collection('threads_post_context').doc(`ctx_${threadId}`);
  const ctxDoc = await ctxRef.get();

  if (ctxDoc.exists) {
    const data = ctxDoc.data();
    if (data.product_id) {
      let productTitle = data.product_title || '';
      if (!productTitle && data.product_id) {
        try {
          const pSnap = await db.collection('affiliate_products').doc(data.product_id).get();
          if (pSnap.exists) productTitle = pSnap.data()?.title || '';
        } catch (_) {}
      }
      return {
        productId: data.product_id,
        productTitle,
        caption: data.caption || ''
      };
    }
  }

  // Tier 2 Fallback: Ambil caption thread langsung dari Meta Threads API & cari shortlink
  try {
    const threadInfo = await get(threadId, account.access_token, { fields: 'id,text,permalink,shortcode,timestamp' });
    const text = threadInfo?.text || '';
    const officialPermalink = threadInfo?.permalink || (threadInfo?.shortcode ? `https://www.threads.net/post/${threadInfo.shortcode}` : '');

    if (text) {
      // Ekstrak kode shortlink seperti /s/r_xxx atau shortlink domain
      const linkMatch = text.match(/\/s\/([a-zA-Z0-9_\-]+)/i) || text.match(/(?:shopee\.co\.id|s\.shopee\.co\.id)\/[^\s]+/i);
      
      if (linkMatch && linkMatch[1]) {
        const shortCode = linkMatch[1];
        let slData = null;

        // 1. Cek langsung Document ID di collection short_links
        const directDoc = await db.collection('short_links').doc(shortCode).get();
        if (directDoc.exists) {
          slData = directDoc.data();
        } else {
          // 2. Cek field code
          const qSnap = await db.collection('short_links')
            .where('code', '==', shortCode)
            .limit(1)
            .get();
          if (!qSnap.empty) {
            slData = qSnap.docs[0].data();
          } else {
            // 3. Cek field short_code
            const altSnap = await db.collection('short_links')
              .where('short_code', '==', shortCode)
              .limit(1)
              .get();
            if (!altSnap.empty) {
              slData = altSnap.docs[0].data();
            }
          }
        }

        if (slData && slData.product_id) {
          // Auto-cache context untuk pemanggilan berikutnya
          await ctxRef.set({
            id: `ctx_${threadId}`,
            account_id: account.id,
            thread_id: String(threadId),
            user_id: userId,
            product_id: slData.product_id,
            product_title: slData.title || '',
            shortlink_code: shortCode,
            caption: text,
            permalink: officialPermalink,
            published_at: threadInfo.timestamp || new Date().toISOString(),
            status: 'ACTIVE',
          }, { merge: true });

          console.log(`[InboundEngine] 🔗 Context auto-resolved via shortlink #${shortCode} -> Product: ${slData.product_id}`);
          return {
            productId: slData.product_id,
            productTitle: slData.title || '',
            caption: text,
            permalink: officialPermalink
          };
        }
      }

      // Tier 3 Fallback: Cocokkan teks caption postingan dengan katalog produk milik user
      const prodsSnap = await db.collection('affiliate_products')
        .where('user_id', '==', userId)
        .get();

      const products = prodsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.is_active !== false && p.lifecycle_status !== 'STOPPED');

      const match = matchProductToPublicPost(text, products);
      if (match.matchedProduct) {
        await ctxRef.set({
          id: `ctx_${threadId}`,
          account_id: account.id,
          thread_id: String(threadId),
          user_id: userId,
          product_id: match.matchedProduct.id,
          product_title: match.matchedProduct.title || '',
          caption: text,
          permalink: officialPermalink,
          published_at: threadInfo.timestamp || new Date().toISOString(),
          status: 'ACTIVE',
        }, { merge: true });

        console.log(`[InboundEngine] 🎯 Context auto-matched via caption text -> Product: ${match.matchedProduct.title}`);
        return {
          productId: match.matchedProduct.id,
          productTitle: match.matchedProduct.title || '',
          caption: text,
          permalink: officialPermalink
        };
      }
    }
  } catch (err) {
    console.warn(`[InboundEngine] Warning resolving fallback context for thread #${threadId}:`, err.message);
  }

  return { productId: null, productTitle: '', caption: '', permalink: '' };
}

/**
 * Memproses 1 komentar masuk pada postingan sendiri
 * @param {Object} params 
 * @param {Object} params.reply - Data objek komentar dari API Threads
 * @param {string} params.threadId - ID Utas utama
 * @param {Object} params.account - Data akun sosial media dari DB
 * @param {string} params.userId - ID User pemilik akun
 * @param {Set<string>} [params.ownedUsernames] - Himpunan semua username milik user
 */
async function processSingleInboundReply({ reply, threadId, account, userId, ownedUsernames = new Set() }) {
  // 1. Pemeriksaan Akun Sendiri (dengan Pengecualian Akun Testing imveeveena)
  const authorUser = String(reply.username || '').toLowerCase().trim();
  const pageName = String(account.page_name || '').toLowerCase().trim();
  const username = String(account.username || '').toLowerCase().trim();

  const isSelfAccountScan = authorUser && (authorUser === pageName || authorUser === username);
  const isSisterAccount = authorUser && ownedUsernames instanceof Set && ownedUsernames.has(authorUser);
  const isWhitelistedTestingAccount = authorUser === 'imveeveena';

  // Jika akun berkomentar di postingan miliknya sendiri yang sama persis
  if (isSelfAccountScan) {
    return { processed: false, reason: `Komentar akun sendiri pada postingan sendiri (@${authorUser}) diabaikan.` };
  }

  // Jika akun internal lain dan BUKAN akun testing yang di-whitelist
  if (isSisterAccount && !isWhitelistedTestingAccount) {
    return { processed: false, reason: `Komentar dari akun internal sister (@${authorUser}) diabaikan.` };
  }

  // 2. Ambil konteks produk dengan multi-tier fallback
  const threadContext = await resolveThreadProductContext(threadId, account, userId);
  const productId = threadContext.productId;
  const productTitle = threadContext.productTitle;
  const threadCaption = threadContext.caption;
  
  if (!productId) {
    return { processed: false, reason: `Tidak ditemukan data context produk untuk thread #${threadId}` };
  }

  // 3. Klasifikasi intensi komentar menggunakan Intent AI & Kamus Gaul Indonesia
  const intentResult = await classifyCommentIntent(reply.text);
  console.log(`[InboundEngine] Komentar "${reply.text?.slice(0, 30)}..." -> Intent: ${intentResult.intent} (${intentResult.confidence})`);

  // Hanya proses jika berniat meminta link, tanya harga, atau bertanya detail produk
  const allowedIntents = ['LINK_REQUEST', 'PRICE_INQUIRY', 'PRODUCT_QUESTION'];
  if (!allowedIntents.includes(intentResult.intent)) {
    return {
      processed: false,
      intent: intentResult.intent,
      reason: `Intensi bukan permintaan link atau info produk (${intentResult.intent}).`,
    };
  }

  // 4. Lakukan evaluasi Three-Tier Compliance
  const compliance = await evaluateCompliance({
    userId,
    accountId: account.id,
    threadId,
    authorId: reply.id, // Gunakan ID reply/author untuk cooldown
    productId,
    actionType: 'INBOUND',
    token: account.access_token,
  });

  if (compliance.decision !== 'ALLOW') {
    console.warn(`[InboundEngine] ⛔ Balasan diblokir oleh Compliance Engine: ${compliance.reason}`);
    return { processed: false, reason: compliance.reason };
  }

  // 5. Eksekusi publikasi balasan melalui Dispatcher
  try {
    const dispatchResult = await dispatchReply({
      userId,
      accountId: account.id,
      accountName: account.page_name || account.username || 'Threads Account',
      platform: account.platform || 'threads',
      threadsUserId: account.page_id,
      token: account.access_token,
      targetReplyId: reply.id,
      threadId,
      threadCaption,
      incomingCommentText: reply.text || '',
      authorId: reply.id,
      authorUsername: reply.username || '',
      productId,
      productTitle,
      intent: intentResult.intent,
      actionType: 'INBOUND',
      style: 'helpful',
    });

    return {
      processed: true,
      success: dispatchResult.success,
      publishedPostId: dispatchResult.publishedPostId,
    };
  } catch (err) {
    return { processed: false, error: err.message };
  }
}

module.exports = {
  processSingleInboundReply,
  resolveThreadProductContext,
};
