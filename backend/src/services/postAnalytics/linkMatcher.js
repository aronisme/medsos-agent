const { db } = require('../../config/firebase');

const URL_REGEX = /(https?:\/\/[^\s"'<>\(\)]+)/gi;

/**
 * Mengekstrak semua link yang ada di dalam caption dan mencocokkannya dengan database short_links.
 * @param {string} caption 
 * @param {string} userId 
 * @returns {Promise<{short_links: Array, total_clicks: number, human_clicks: number}>}
 */
async function matchAffiliateLinks(caption, userId = null) {
  if (!caption || typeof caption !== 'string') {
    return { short_links: [], total_clicks: 0, human_clicks: 0 };
  }

  const matches = caption.match(URL_REGEX) || [];
  if (matches.length === 0) {
    return { short_links: [], total_clicks: 0, human_clicks: 0 };
  }

  const matchedLinks = [];
  const processedCodes = new Set();

  for (const rawUrl of matches) {
    // 1. Check if URL contains short code pattern /s/{code}
    const shortCodeMatch = rawUrl.match(/\/s\/([a-zA-Z0-9-_]+)/i);
    let code = shortCodeMatch ? shortCodeMatch[1] : null;

    let docSnap = null;
    if (code) {
      docSnap = await db.collection('short_links').doc(code).get();
    }

    // 2. If not found by slug, search if product_url or destination_url matches
    if (!docSnap || !docSnap.exists) {
      const cleanUrl = rawUrl.split('?')[0]; // basic clean
      const querySnap = await db.collection('short_links')
        .where('destination_url', '==', rawUrl)
        .limit(1)
        .get();

      if (!querySnap.empty) {
        docSnap = querySnap.docs[0];
        code = docSnap.id;
      }
    }

    if (docSnap && docSnap.exists && !processedCodes.has(code)) {
      processedCodes.add(code);
      const data = docSnap.data();
      const totalClicks = Number(data.total_clicks) || 0;
      const humanClicks = Number(data.human_clicks) || totalClicks;

      matchedLinks.push({
        code,
        url: rawUrl,
        product_id: data.product_id || '',
        title: data.title || 'Shopee Product',
        image_url: data.image_url || '',
        price: data.price || 0,
        total_clicks: totalClicks,
        human_clicks: humanClicks,
        destination_url: data.destination_url || data.product_url || '',
      });
    }
  }

  const totalClicks = matchedLinks.reduce((sum, l) => sum + l.total_clicks, 0);
  const humanClicks = matchedLinks.reduce((sum, l) => sum + l.human_clicks, 0);

  return {
    short_links: matchedLinks,
    total_clicks: totalClicks,
    human_clicks: humanClicks,
  };
}

module.exports = {
  matchAffiliateLinks,
};
