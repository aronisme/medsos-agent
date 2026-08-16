/**
 * Shopee Product Extractor
 * Executes HTTP extraction using verified Shopee web strategies and returns normalized data.
 */

const { adaptShopeeProduct } = require('./product-adapter');
const { parseShopeeUrl } = require('./url-parser');

const ENDPOINTS = {
  pdp_get_pc: (shopId, itemId) => `https://shopee.co.id/api/v4/pdp/get_pc?item_id=${itemId}&shop_id=${shopId}`,
  item_get: (shopId, itemId) => `https://shopee.co.id/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`
};

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': 'https://shopee.co.id/',
  'x-api-source': 'pc',
  'x-shopee-client-timezone': '7',
  'sec-ch-ua': '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin'
};

/**
 * Performs a safe HTTP fetch with timeout and error mapping.
 * @param {string} url 
 * @param {number} timeoutMs 
 * @returns {Promise<{ status: number, json: any }>}
 */
async function safeFetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 403 || response.status === 429) {
      const err = new Error(`Shopee blocked request with status ${response.status}`);
      err.code = 'SHOPEE_BLOCKED';
      err.status = response.status;
      throw err;
    }

    if (!response.ok) {
      const err = new Error(`Shopee request failed with status ${response.status}`);
      err.code = 'SHOPEE_REQUEST_FAILED';
      err.status = response.status;
      throw err;
    }

    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      const err = new Error('Shopee returned non-JSON response');
      err.code = 'SHOPEE_RESPONSE_INVALID';
      throw err;
    }

    return { status: response.status, json };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      const err = new Error('Shopee extraction request timed out');
      err.code = 'TIMEOUT';
      throw err;
    }
    throw error;
  }
}

/**
 * Extracts product details from Shopee by Shop ID and Item ID.
 * @param {string} shopId 
 * @param {string} itemId 
 * @returns {Promise<{ product: object, meta: object }>}
 */
async function extractProductByIds(shopId, itemId) {
  const startTime = Date.now();
  let strategy = 'pdp_get_pc';
  let rawResponse = null;

  try {
    const pdpUrl = ENDPOINTS.pdp_get_pc(shopId, itemId);
    const res = await safeFetchJson(pdpUrl);
    rawResponse = res.json;

    // Check if error inside response
    if (rawResponse && rawResponse.error) {
      // Try fallback to item_get
      strategy = 'item_get';
      const itemUrl = ENDPOINTS.item_get(shopId, itemId);
      const fallbackRes = await safeFetchJson(itemUrl);
      rawResponse = fallbackRes.json;
    }
  } catch (err) {
    // If blocked or failed, attempt item_get strategy
    if (err.code !== 'TIMEOUT') {
      try {
        strategy = 'item_get';
        const itemUrl = ENDPOINTS.item_get(shopId, itemId);
        const fallbackRes = await safeFetchJson(itemUrl);
        rawResponse = fallbackRes.json;
      } catch {
        throw err;
      }
    } else {
      throw err;
    }
  }

  if (!rawResponse || (rawResponse.error && !rawResponse.data && !rawResponse.item)) {
    const error = new Error(rawResponse?.error_msg || 'Product not found or unavailable');
    error.code = 'PRODUCT_NOT_FOUND';
    throw error;
  }

  const { product, diagnostics } = adaptShopeeProduct(rawResponse, shopId, itemId);
  const durationMs = Date.now() - startTime;

  return {
    product,
    meta: {
      strategy,
      cached: false,
      duration_ms: durationMs,
      fields: diagnostics
    }
  };
}

/**
 * End-to-end extraction from input URL string.
 * @param {string} inputUrl 
 * @returns {Promise<{ product: object, meta: object }>}
 */
async function extractProductFromUrl(inputUrl) {
  const { shop_id, item_id } = await parseShopeeUrl(inputUrl);
  return await extractProductByIds(shop_id, item_id);
}

module.exports = {
  extractProductByIds,
  extractProductFromUrl,
  safeFetchJson,
  ENDPOINTS
};
