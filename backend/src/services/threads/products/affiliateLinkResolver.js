const crypto = require('crypto');
const { db } = require('../../../config/firebase');
const { validateProductForPromotion } = require('./productValidator');
const { buildAffiliateLink } = require('../../../routes/affiliate');

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

  const rawTargetUrl = product.product_url || product.affiliate_link || product.link;
  const baseUrl = (process.env.PUBLIC_URL || process.env.BASE_URL || 'https://shopee-link-aff.vercel.app')
    .replace(/medsos-agent\.vercel\.app/g, 'shopee-link-aff.vercel.app');

  try {
    // 1. Coba cari shortlink yang sudah ada untuk produk & user ini
    // Periksa apakah ada shortlink yang sudah aktif
    const existingSnap = await db.collection('short_links')
      .where('user_id', '==', userId)
      .where('product_id', '==', productId)
      .limit(5)
      .get();

    if (!existingSnap.empty) {
      // Prioritaskan yang platform threads, atau ambil yang pertama
      const threadsDoc = existingSnap.docs.find(d => {
        const data = d.data();
        return (data.platform || data.bound_platform || '').toLowerCase() === 'threads';
      }) || existingSnap.docs[0];

      const code = threadsDoc.id || threadsDoc.data().code;
      // Pastikan dokumen yang ditemukan memiliki destination_url valid
      const existingData = threadsDoc.data();
      if (!existingData.destination_url && rawTargetUrl) {
        const affiliateId = process.env.SHOPEE_AFFILIATE_ID || '11328861338';
        const repairedDest = buildAffiliateLink(rawTargetUrl, { source: 'threads', content: 'auto_reply' }, affiliateId);
        await threadsDoc.ref.update({
          destination_url: repairedDest,
          product_url: rawTargetUrl,
          target_url: repairedDest,
          updated_at: new Date().toISOString()
        });
      }
      return `${baseUrl}/s/${code}`;
    }

    // 2. Buat URL tujuan resmi Shopee Affiliate
    const affiliateId = process.env.SHOPEE_AFFILIATE_ID || '11328861338';
    const tracking = {
      source: 'threads',
      campaign: 'autoreply',
      content: 'inbound_lead'
    };
    const destinationUrl = buildAffiliateLink(rawTargetUrl, tracking, affiliateId) || rawTargetUrl;

    let imageUrl = '';
    if (product.image) imageUrl = product.image;
    else if (product.image_url) imageUrl = product.image_url;
    else if (Array.isArray(product.images) && product.images.length > 0) imageUrl = product.images[0];
    else if (Array.isArray(product.media) && product.media.length > 0) imageUrl = product.media[0]?.url || '';

    // 3. Buat shortlink baru dengan skema lengkap & kompatibilitas tinggi
    const shortCode = generateShortCode();
    const now = new Date().toISOString();

    await db.collection('short_links').doc(shortCode).set({
      id: shortCode,
      code: shortCode,
      short_code: shortCode,
      user_id: userId,
      product_id: productId,
      title: product.title || 'Shopee Product',
      price: Number(product.price || 0),
      image_url: imageUrl,
      product_url: rawTargetUrl,
      destination_url: destinationUrl,
      target_url: destinationUrl,
      platform: 'threads',
      bound_platform: 'threads',
      tracking: tracking,
      total_clicks: 0,
      human_clicks: 0,
      bot_clicks: 0,
      created_at: now,
      updated_at: now
    });

    return `${baseUrl}/s/${shortCode}`;
  } catch (err) {
    console.warn('[AffiliateLinkResolver] Fallback to raw targetUrl:', err.message);
    return rawTargetUrl;
  }
}

module.exports = {
  resolveAffiliateLink,
};

