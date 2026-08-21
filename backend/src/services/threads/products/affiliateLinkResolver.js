const crypto = require('crypto');
const { db } = require('../../../config/firebase');
const { validateProductForPromotion } = require('./productValidator');

function generateShortCode(length = 6) {
  return crypto.randomBytes(4).toString('base64url').slice(0, length);
}

/**
 * Mengambil atau membuat shortlink terlacak untuk balasan Threads
 * @param {string} productId 
 * @param {string} userId 
 * @returns {Promise<string>} URL afiliasi siap pakai
 */
async function resolveAffiliateLink(productId, userId) {
  const { valid, product, reason } = await validateProductForPromotion(productId);
  if (!valid || !product) {
    throw new Error(reason || 'Gagal memvalidasi produk untuk link afiliasi.');
  }

  const targetUrl = product.product_url || product.affiliate_link || product.link;
  const baseUrl = (process.env.PUBLIC_URL || process.env.BASE_URL || 'https://shopee-link-aff.vercel.app')
    .replace(/medsos-agent\.vercel\.app/g, 'shopee-link-aff.vercel.app');

  try {
    // 1. Coba cari shortlink yang sudah ada untuk produk & user ini khusus platform Threads
    const existingSnap = await db.collection('short_links')
      .where('user_id', '==', userId)
      .where('product_id', '==', productId)
      .where('bound_platform', '==', 'threads')
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      const code = existingSnap.docs[0].id;
      return `${baseUrl}/s/${code}`;
    }

    // 2. Buat shortlink baru jika belum ada
    const shortCode = generateShortCode();
    await db.collection('short_links').doc(shortCode).set({
      id: shortCode,
      code: shortCode,
      target_url: targetUrl,
      user_id: userId,
      product_id: productId,
      title: product.title || 'Shopee Product',
      bound_platform: 'threads',
      created_at: new Date().toISOString(),
      clicks: 0,
    });

    return `${baseUrl}/s/${shortCode}`;
  } catch (err) {
    console.warn('[AffiliateLinkResolver] Fallback to raw targetUrl:', err.message);
    return targetUrl;
  }
}

module.exports = {
  resolveAffiliateLink,
};
