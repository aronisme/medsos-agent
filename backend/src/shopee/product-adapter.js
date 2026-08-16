/**
 * Shopee Product Adapter
 * Transforms raw Shopee response into clean NormalizedProduct JSON schema.
 */

const { normalizePrice, normalizeDiscount } = require('./price-normalizer');
const { resolveImages, resolveImageUrl, extractVideos } = require('./media-resolver');

/**
 * Extracts product variants / models from Shopee raw item data.
 * @param {object} itemData 
 * @returns {Array<{ name: string, price: number|null, stock: number|null, image: string|null }>}
 */
function extractVariants(itemData) {
  if (!itemData || typeof itemData !== 'object') return [];

  const models = itemData.models || itemData.tier_variations_models || [];
  if (Array.isArray(models) && models.length > 0) {
    return models.map(m => {
      const price = normalizePrice(m.price || m.price_before_discount, 'price');
      const stock = typeof m.stock === 'number' ? m.stock : (typeof m.normal_stock === 'number' ? m.normal_stock : null);
      const img = m.image ? resolveImageUrl(m.image) : null;
      return {
        name: m.name || m.model_name || 'Default',
        price,
        stock,
        image: img
      };
    });
  }

  // Fallback: tier variations
  if (Array.isArray(itemData.tier_variations) && itemData.tier_variations.length > 0) {
    const tier = itemData.tier_variations[0];
    if (Array.isArray(tier.options)) {
      return tier.options.map((opt, idx) => {
        const imgKey = tier.images ? tier.images[idx] : null;
        return {
          name: opt,
          price: normalizePrice(itemData.price, 'price'),
          stock: null,
          image: imgKey ? resolveImageUrl(imgKey) : null
        };
      });
    }
  }

  return [];
}

/**
 * Extracts clean description text from raw item data.
 * @param {object} itemData 
 * @returns {string|null}
 */
function extractDescription(itemData) {
  if (!itemData) return null;

  if (typeof itemData.description === 'string' && itemData.description.trim()) {
    return itemData.description.trim();
  }

  if (itemData.description_info && typeof itemData.description_info === 'object') {
    if (typeof itemData.description_info.description === 'string') {
      return itemData.description_info.description.trim();
    }
    // Rich text blocks
    if (Array.isArray(itemData.description_info.extended_description?.field_list)) {
      const texts = [];
      for (const field of itemData.description_info.extended_description.field_list) {
        if (field.field_type === 'text' && field.text) {
          texts.push(field.text);
        }
      }
      if (texts.length > 0) return texts.join('\n\n');
    }
  }

  return null;
}

/**
 * Adapts raw Shopee API response to standard NormalizedProduct schema.
 * 
 * @param {object} rawResponse 
 * @param {string} fallbackShopId 
 * @param {string} fallbackItemId 
 * @returns {{ product: object, diagnostics: object }}
 */
function adaptShopeeProduct(rawResponse, fallbackShopId, fallbackItemId) {
  if (!rawResponse || typeof rawResponse !== 'object') {
    throw new Error('Invalid raw response object');
  }

  // Detect item object location across different Shopee payload shapes
  const item = rawResponse.data?.item || rawResponse.data || rawResponse.item || rawResponse;

  const shopId = String(item.shopid || item.shop_id || fallbackShopId || '');
  const itemId = String(item.itemid || item.item_id || fallbackItemId || '');

  // Title
  const title = item.name || item.title || null;

  // Prices
  const price = normalizePrice(item.price || item.price_min || item.price_max, 'price');
  const originalPrice = normalizePrice(
    item.price_before_discount || item.price_max_before_discount || item.price_min_before_discount,
    'price_before_discount'
  );
  const discount = normalizeDiscount(item.discount || item.raw_discount || item.show_discount);

  // Images
  let rawImages = [];
  if (Array.isArray(item.images)) {
    rawImages = item.images;
  } else if (item.image) {
    rawImages = [item.image];
  }
  const images = resolveImages(rawImages);

  // Videos
  const videos = extractVideos(item);

  // Variants
  const variants = extractVariants(item);

  // Rating & Sold
  let rating = null;
  let ratingCount = null;
  if (item.item_rating) {
    if (typeof item.item_rating.rating_star === 'number') {
      rating = Number(item.item_rating.rating_star.toFixed(1));
    }
    if (Array.isArray(item.item_rating.rating_count)) {
      ratingCount = item.item_rating.rating_count.reduce((acc, curr) => acc + (Number(curr) || 0), 0);
    } else if (typeof item.item_rating.rcount_with_context === 'number') {
      ratingCount = item.item_rating.rcount_with_context;
    }
  }

  const soldCount = typeof item.historical_sold === 'number' 
    ? item.historical_sold 
    : (typeof item.sold === 'number' ? item.sold : null);

  const stock = typeof item.stock === 'number' 
    ? item.stock 
    : (typeof item.normal_stock === 'number' ? item.normal_stock : null);

  // Description
  const description = extractDescription(item);

  // Shop Info
  const shopData = rawResponse.data?.shop_info || item.shop_info || {};
  const shop = {
    id: shopId || null,
    name: shopData.shop_name || shopData.name || item.shop_name || null,
    location: shopData.shop_location || item.shop_location || item.shop_loc || null,
    rating: typeof shopData.rating_star === 'number' ? Number(shopData.rating_star.toFixed(1)) : null
  };

  const canonicalUrl = `https://shopee.co.id/product/${shopId}/${itemId}`;

  const normalized = {
    shop_id: shopId,
    item_id: itemId,
    title,
    price,
    original_price: originalPrice,
    discount_percentage: discount,
    description,
    images,
    videos,
    variants,
    stock,
    rating,
    rating_count: ratingCount,
    sold_count: soldCount,
    shop,
    canonical_url: canonicalUrl
  };

  const fieldDiagnostics = {
    title: Boolean(title),
    price: Boolean(price !== null),
    images: images.length > 0,
    videos: videos.length > 0,
    variants: variants.length > 0,
    description: Boolean(description),
    shop: Boolean(shop.name || shop.location)
  };

  return {
    product: normalized,
    diagnostics: fieldDiagnostics
  };
}

module.exports = {
  adaptShopeeProduct,
  extractVariants,
  extractDescription
};
