/**
 * Shopee Price Normalizer
 * Explicit field-based price conversion (micro-currency to nominal integer).
 */

const MICRO_UNIT_FIELDS = new Set([
  'price',
  'price_min',
  'price_max',
  'price_before_discount',
  'price_min_before_discount',
  'price_max_before_discount',
  'raw_price',
  'hidden_price_display'
]);

/**
 * Normalizes a raw price value based on its source field representation.
 * Shopee stores internal prices in 10^-5 units (e.g. 12900000000 -> 129000).
 * 
 * @param {number|string|null|undefined} rawValue 
 * @param {string} sourceField 
 * @returns {number|null}
 */
function normalizePrice(rawValue, sourceField = 'price') {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }

  const num = Number(rawValue);
  if (isNaN(num) || num < 0) {
    return null;
  }

  // If this is a known micro-unit field, convert by dividing 100,000
  if (MICRO_UNIT_FIELDS.has(sourceField.toLowerCase())) {
    // If Shopee already supplied an already-normalized number (e.g. directly 129000 instead of 12900000000)
    // Shopee raw micro-currency for IDR 10,000 is 1,000,000,000
    if (num >= 1000000) {
      return Math.round(num / 100000);
    }
    return Math.round(num);
  }

  // Direct nominal field
  return Math.round(num);
}

/**
 * Normalizes discount percentage.
 * @param {number|string|null|undefined} discountVal 
 * @returns {string|null} e.g. "35%"
 */
function normalizeDiscount(discountVal) {
  if (!discountVal) return null;
  const str = String(discountVal).replace('%', '').trim();
  const num = parseInt(str, 10);
  if (isNaN(num) || num <= 0) return null;
  return `${num}%`;
}

module.exports = {
  normalizePrice,
  normalizeDiscount
};
