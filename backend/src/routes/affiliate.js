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
    const { product_url, tracking } = req.body;
    
    if (!product_url) {
      return res.status(400).json({ success: false, error: 'product_url is required' });
    }

    // Use environment variable for single-account MVP
    const affiliateId = process.env.SHOPEE_AFFILIATE_ID || '11328861338'; // Defaulting to the user's ID for safety if env not set

    const affiliateUrl = buildAffiliateLink(product_url, tracking, affiliateId);
    
    // Generate short code
    const shortCode = generateShortCode();
    
    // Save to Firestore
    await db.collection('short_links').doc(shortCode).set({
      destination_url: affiliateUrl,
      product_url: product_url,
      tracking: tracking || null,
      created_at: new Date()
    });

    // The short url will point to our backend's redirect route
    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    const shortUrl = `${baseUrl}/s/${shortCode}`;

    res.json({
      success: true,
      short_url: shortUrl,
      short_code: shortCode
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
    const { products, tracking } = req.body;
    
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ success: false, error: 'products array is required' });
    }

    const affiliateId = process.env.SHOPEE_AFFILIATE_ID || '11328861338';
    const baseUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
    
    const results = [];
    const batch = db.batch();

    for (const item of products) {
      if (!item.url) continue;

      const affiliateUrl = buildAffiliateLink(item.url, tracking, affiliateId);
      const shortCode = generateShortCode();
      const shortUrl = `${baseUrl}/s/${shortCode}`;

      const docRef = db.collection('short_links').doc(shortCode);
      batch.set(docRef, {
        destination_url: affiliateUrl,
        product_url: item.url,
        tracking: tracking || null,
        created_at: new Date()
      });

      results.push({
        product_url: item.url,
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
