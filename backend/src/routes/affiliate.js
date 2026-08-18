const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');

// Utility to generate short code (e.g., a8K2xP)
const generateShortCode = (length = 6) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Utility to normalize sub_id parts
const normalizeSubId = (str) => {
  if (!str) return '';
  return str.replace(/[-\s]+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').substring(0, 50);
};

// Main function to build the Shopee Affiliate Link
const buildAffiliateLink = (productUrl, tracking, affiliateId) => {
  let originLink = '';
  const parsedInput = new URL(productUrl);
  
  if (parsedInput.hostname === 'shope.ee' || parsedInput.hostname === 's.shopee.co.id') {
    const extractedOrigin = parsedInput.searchParams.get('origin_link');
    if (extractedOrigin) {
      originLink = decodeURIComponent(extractedOrigin);
    } else {
      originLink = productUrl;
    }
  } else {
    originLink = productUrl;
  }

  const safeEncodedOrigin = encodeURIComponent(originLink);
  
  // Format sub_id using tracking object
  let subIdParam = '';
  if (tracking) {
    const p1 = normalizeSubId(tracking.sub_publisher_id || tracking.source);
    const p2 = normalizeSubId(tracking.network_click_id || tracking.campaign);
    const p3 = normalizeSubId(tracking.referral_source || tracking.content);
    const p4 = normalizeSubId(tracking.custom_1);
    const p5 = normalizeSubId(tracking.custom_2);
    
    if (p1 || p2 || p3 || p4 || p5) {
      subIdParam = `&sub_id=${p1}-${p2}-${p3}-${p4}-${p5}`;
    }
  }

  return `https://s.shopee.co.id/an_redir?origin_link=${safeEncodedOrigin}&affiliate_id=${affiliateId}${subIdParam}`;
};

// POST /api/v1/affiliate/shopee
// Generate a single affiliate link and short URL
router.post('/', async (req, res) => {
  try {
    const {
      product_url,
      title,
      product_id,
      image_url,
      price,
      tracking
    } = req.body || {};
    
    if (!product_url) {
      return res.status(400).json({ success: false, error: 'product_url is required' });
    }

    const affiliateId = process.env.SHOPEE_AFFILIATE_ID || '11328861338';
    const affiliateUrl = buildAffiliateLink(product_url, tracking, affiliateId);
    
    // Generate short code
    const shortCode = generateShortCode();
    const now = new Date().toISOString();
    
    // Save to Firestore with full rich metadata
    await db.collection('short_links').doc(shortCode).set({
      code: shortCode,
      user_id: req.user?.id || 'system',
      product_id: product_id || '',
      title: title || 'Shopee Product',
      image_url: image_url || '',
      price: price || 0,
      product_url: product_url,
      destination_url: affiliateUrl,
      tracking: tracking || null,
      total_clicks: 0,
      human_clicks: 0,
      bot_clicks: 0,
      created_at: now,
      updated_at: now
    });

    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const shortUrl = `${baseUrl}/s/${shortCode}`;

    res.json({
      success: true,
      short_url: shortUrl,
      short_code: shortCode,
      affiliate_url: affiliateUrl
    });

  } catch (error) {
    console.error('Error generating affiliate link:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/v1/affiliate/shopee/batch
// Generate multiple affiliate links
router.post('/batch', async (req, res) => {
  try {
    const { products, tracking } = req.body || {};
    
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, error: 'products array is required' });
    }

    const affiliateId = process.env.SHOPEE_AFFILIATE_ID || '11328861338';
    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const now = new Date().toISOString();
    
    const results = [];
    const batch = db.batch();

    for (const item of products) {
      const url = item.url || item.product_url;
      if (!url) continue;

      const affiliateUrl = buildAffiliateLink(url, tracking, affiliateId);
      const shortCode = generateShortCode();
      const shortUrl = `${baseUrl}/s/${shortCode}`;

      const docRef = db.collection('short_links').doc(shortCode);
      batch.set(docRef, {
        code: shortCode,
        user_id: req.user?.id || 'system',
        product_id: item.product_id || item.id || '',
        title: item.title || item.name || 'Shopee Product',
        image_url: item.image || item.image_url || (Array.isArray(item.images) ? item.images[0] : ''),
        price: item.price || 0,
        product_url: url,
        destination_url: affiliateUrl,
        tracking: tracking || null,
        total_clicks: 0,
        human_clicks: 0,
        bot_clicks: 0,
        created_at: now,
        updated_at: now
      });

      results.push({
        title: item.title || item.name || 'Shopee Product',
        product_url: url,
        affiliate_url: affiliateUrl,
        short_url: shortUrl,
        short_code: shortCode
      });
    }

    // Commit all short links to Firestore in one transaction
    await batch.commit();

    res.json({
      success: true,
      links: results
    });

  } catch (error) {
    console.error('Error generating batch affiliate links:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
module.exports.buildAffiliateLink = buildAffiliateLink;
module.exports.normalizeSubId = normalizeSubId;

