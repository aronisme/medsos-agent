/**
 * Shopee URL Parser & Resolver
 * Handles domain validation, shortlink redirection, and shop_id / item_id extraction.
 */

const ALLOWED_DOMAINS = [
  'shopee.co.id',
  's.shopee.co.id',
  'shope.ee',
  'my.shopee.co.id'
];

/**
 * Validates whether a URL belongs to Shopee domains (SSRF guard).
 * @param {string} rawUrl 
 * @returns {boolean}
 */
function isValidShopeeDomain(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return ALLOWED_DOMAINS.some(domain => 
      parsed.hostname === domain || parsed.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

/**
 * Resolves shortlink (e.g. s.shopee.co.id/xxx or shope.ee/xxx) to destination URL.
 * @param {string} shortUrl 
 * @param {number} timeoutMs 
 * @returns {Promise<string>}
 */
async function resolveShortlink(shortUrl, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(shortUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response.url || shortUrl;
  } catch (error) {
    clearTimeout(timeoutId);
    throw new Error(`Failed to resolve shortlink: ${error.message}`);
  }
}

/**
 * Extracts shop_id and item_id from standard or mobile Shopee URL.
 * Supported patterns:
 * 1. ...-i.12345678.987654321
 * 2. .../product/12345678/987654321
 * 3. ...?itemid=987654321&shopid=12345678
 * @param {string} targetUrl 
 * @returns {{ shop_id: string, item_id: string } | null}
 */
function extractProductIds(targetUrl) {
  if (!targetUrl) return null;

  try {
    const parsed = new URL(targetUrl);

    // Check query parameters first
    const qItemId = parsed.searchParams.get('itemid') || parsed.searchParams.get('item_id');
    const qShopId = parsed.searchParams.get('shopid') || parsed.searchParams.get('shop_id');
    if (qItemId && qShopId && /^\d+$/.test(qItemId) && /^\d+$/.test(qShopId)) {
      return { shop_id: qShopId, item_id: qItemId };
    }

    const pathname = parsed.pathname;

    // Pattern 1: -i.<shop_id>.<item_id> (Standard desktop URL)
    const standardMatch = pathname.match(/-i\.(\d+)\.(\d+)/);
    if (standardMatch) {
      return { shop_id: standardMatch[1], item_id: standardMatch[2] };
    }

    // Pattern 2: /product/<shop_id>/<item_id> (Mobile/App/Universal URL)
    const productMatch = pathname.match(/\/product\/(\d+)\/(\d+)/);
    if (productMatch) {
      return { shop_id: productMatch[1], item_id: productMatch[2] };
    }

    // Pattern 3: dot-separated numeric end: .../<shop_id>.<item_id>
    const dotMatch = pathname.match(/\/(\d+)\.(\d+)(?:\?|$)/);
    if (dotMatch) {
      return { shop_id: dotMatch[1], item_id: dotMatch[2] };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Full parsing pipeline: validate domain -> resolve shortlink if needed -> extract IDs.
 * @param {string} inputUrl 
 * @returns {Promise<{ shop_id: string, item_id: string, resolved_url: string }>}
 */
async function parseShopeeUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    const error = new Error('URL input is required');
    error.code = 'INVALID_URL';
    throw error;
  }

  const cleanUrl = inputUrl.trim();

  if (!isValidShopeeDomain(cleanUrl)) {
    const error = new Error('URL must belong to Shopee domain (shopee.co.id, s.shopee.co.id, or shope.ee)');
    error.code = 'INVALID_SHOPEE_URL';
    throw error;
  }

  let finalUrl = cleanUrl;
  const parsed = new URL(cleanUrl);

  // If it's a shortlink, resolve it
  if (parsed.hostname === 's.shopee.co.id' || parsed.hostname === 'shope.ee' || parsed.pathname.startsWith('/an_redir')) {
    finalUrl = await resolveShortlink(cleanUrl);
  }

  const ids = extractProductIds(finalUrl);

  if (!ids) {
    const error = new Error('Could not extract valid shop_id and item_id from the provided URL');
    error.code = 'PRODUCT_ID_NOT_FOUND';
    throw error;
  }

  return {
    shop_id: ids.shop_id,
    item_id: ids.item_id,
    resolved_url: finalUrl
  };
}

module.exports = {
  isValidShopeeDomain,
  resolveShortlink,
  extractProductIds,
  parseShopeeUrl
};
