/**
 * Piloterr API Adapter for Shopee
 * Normalizes Piloterr's JSON response to match our standard internal product schema.
 */

function adaptPiloterrProduct(piloterrData, inputUrl) {
  const diagnostics = [];
  
  // Piloterr data structure mapping (flexible)
  // According to Piloterr docs, fields are usually flattened.
  
  const extractNumber = (val) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = parseFloat(val.replace(/[^\d.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const product = {
    shop_id: piloterrData.shop_id || piloterrData.seller?.id || null,
    item_id: piloterrData.product_id || piloterrData.id || null,
    name: piloterrData.title || piloterrData.name || null,
    price: extractNumber(piloterrData.price) || 0,
    original_price: extractNumber(piloterrData.original_price || piloterrData.price) || 0,
    discount: piloterrData.discount || null,
    description: piloterrData.description || null,
    images: Array.isArray(piloterrData.images) ? piloterrData.images : (piloterrData.image ? [piloterrData.image] : []),
    videos: Array.isArray(piloterrData.videos) ? piloterrData.videos : [],
    models: Array.isArray(piloterrData.variants) ? piloterrData.variants.map(v => ({
      name: v.name || v.title,
      price: extractNumber(v.price),
      stock: extractNumber(v.stock)
    })) : [],
    stock: extractNumber(piloterrData.stock) || 0,
    rating: extractNumber(piloterrData.rating) || 0,
    rating_count: extractNumber(piloterrData.reviews_count || piloterrData.rating_count) || 0,
    sold_count: extractNumber(piloterrData.sold_count || piloterrData.sales) || 0,
    shop: {
      name: piloterrData.seller?.name || piloterrData.shop?.name || null,
      location: piloterrData.seller?.location || piloterrData.shop?.location || null,
      rating: extractNumber(piloterrData.seller?.rating || piloterrData.shop?.rating) || null
    },
    url: inputUrl,
    raw_piloterr: piloterrData // For debugging in UI
  };

  // Diagnostics check
  if (!product.name) diagnostics.push('Name missing');
  if (!product.price) diagnostics.push('Price missing or 0');
  if (!product.images.length) diagnostics.push('Images missing');

  return { product, diagnostics };
}

module.exports = {
  adaptPiloterrProduct
};
