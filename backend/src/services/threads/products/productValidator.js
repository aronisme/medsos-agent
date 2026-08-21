const { db } = require('../../../config/firebase');

/**
 * Memvalidasi apakah produk masih aktif dan memiliki link Shopee yang sah
 * @param {string} productId 
 * @returns {Promise<{ valid: boolean, product: Object|null, reason: string|null }>}
 */
async function validateProductForPromotion(productId) {
  if (!productId) {
    return { valid: false, product: null, reason: 'Product ID kosong.' };
  }

  try {
    const docRef = db.collection('affiliate_products').doc(productId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return { valid: false, product: null, reason: `Produk #${productId} tidak ditemukan di katalog.` };
    }

    const product = { id: doc.id, ...doc.data() };
    const url = product.product_url || product.affiliate_link || product.link || '';

    if (!url || !url.startsWith('http')) {
      return { valid: false, product, reason: `Produk "${product.title}" tidak memiliki URL Shopee yang valid.` };
    }

    // Pastikan status produk tidak STOPPED
    if (product.lifecycle_status === 'STOPPED' || product.is_active === false) {
      return { valid: false, product, reason: `Produk "${product.title}" berstatus nonaktif / STOPPED.` };
    }

    return { valid: true, product, reason: null };
  } catch (err) {
    console.error(`[ProductValidator] Error validating product ${productId}:`, err.message);
    return { valid: false, product: null, reason: err.message };
  }
}

module.exports = {
  validateProductForPromotion,
};
