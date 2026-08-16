const express = require('express');
const router = express.Router();
const { extractProductFromUrl, extractProductByIds } = require('../shopee/product-extractor');

/**
 * POST /api/shopee/extract
 * Main endpoint to extract product data by URL or IDs.
 */
router.post('/extract', async (req, res) => {
  try {
    const { url, shop_id, item_id } = req.body;

    if (!url && (!shop_id || !item_id)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_URL',
          message: 'Parameter "url" atau pasangan "shop_id" dan "item_id" wajib disertakan.'
        }
      });
    }

    let result;
    if (url) {
      result = await extractProductFromUrl(url);
    } else {
      result = await extractProductByIds(shop_id, item_id);
    }

    return res.json({
      success: true,
      data: result.product,
      meta: result.meta
    });
  } catch (error) {
    console.error('[Shopee Extractor Error]:', error.message);

    const statusCode = error.code === 'INVALID_URL' || error.code === 'INVALID_SHOPEE_URL' || error.code === 'PRODUCT_ID_NOT_FOUND' 
      ? 400 
      : (error.code === 'PRODUCT_NOT_FOUND' ? 404 : 500);

    return res.status(statusCode).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || 'Terjadi kesalahan saat mengekstrak data produk Shopee.'
      }
    });
  }
});

module.exports = router;
