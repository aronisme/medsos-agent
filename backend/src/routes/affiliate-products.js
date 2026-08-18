const express = require('express');
const { db } = require('../config/firebase');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.use(authRequired);

// Helper to normalize price
const parsePriceNumber = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9]/g, '');
  return parseInt(cleaned, 10) || 0;
};

// GET /api/affiliate-products
// Supports ?search=&category=&media_type=&sort_by=&limit=
router.get('/', async (req, res) => {
  try {
    const { search, category, media_type, sort_by = 'newest', limit = 100 } = req.query;

    const snapshot = await db.collection('affiliate_products')
      .where('user_id', '==', req.user.id)
      .get();

    let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // In-memory filter for search query
    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      items = items.filter(item => 
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.shop_name && item.shop_name.toLowerCase().includes(q)) ||
        (item.shop_location && item.shop_location.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q))
      );
    }

    // Filter by Category
    if (category && category !== 'all') {
      items = items.filter(item => item.category === category);
    }

    // Filter by Media Type (e.g. 'video', 'image')
    if (media_type === 'video') {
      items = items.filter(item => 
        (item.videos && item.videos.length > 0) || 
        (item.media && item.media.some(m => m.type === 'video')) ||
        (item.product_video && String(item.product_video).trim().length > 0)
      );
    } else if (media_type === 'image') {
      items = items.filter(item => 
        (item.images && item.images.length > 0) || 
        (item.media && item.media.some(m => m.type === 'image'))
      );
    }

    // Sorting
    if (sort_by === 'newest') {
      items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    } else if (sort_by === 'oldest') {
      items.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    } else if (sort_by === 'price_asc') {
      items.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sort_by === 'price_desc') {
      items.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sort_by === 'rating') {
      items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    const parsedLimit = parseInt(limit, 10) || 100;
    items = items.slice(0, parsedLimit);

    res.json({ success: true, products: items, total: items.length });
  } catch (err) {
    console.error('Error fetching affiliate products:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/affiliate-products/:id
router.get('/:id', async (req, res) => {
  try {
    const doc = await db.collection('affiliate_products').doc(req.params.id).get();
    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Produk tidak ditemukan.' });
    }
    res.json({ success: true, product: { id: doc.id, ...doc.data() } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/affiliate-products
// Create single product
router.post('/', async (req, res) => {
  try {
    const {
      title,
      price,
      original_price,
      discount,
      currency = 'Rp',
      rating = 5.0,
      sold_count = '',
      shop_name = '',
      shop_location = '',
      category = 'Umum',
      product_url = '',
      affiliate_url = '',
      description = '',
      images = [],
      videos = [],
      media = [],
      variants = [],
      notes = ''
    } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, error: 'Judul produk wajib diisi.' });
    }

    // Build unified media array if not explicitly given
    let unifiedMedia = Array.isArray(media) && media.length > 0 ? media : [];
    if (unifiedMedia.length === 0) {
      if (Array.isArray(videos)) {
        videos.forEach(v => {
          if (v) unifiedMedia.push({ type: 'video', url: typeof v === 'string' ? v : v.url });
        });
      }
      if (Array.isArray(images)) {
        images.forEach(img => {
          if (img) unifiedMedia.push({ type: 'image', url: typeof img === 'string' ? img : img.url });
        });
      }
    }

    const newProduct = {
      user_id: req.user.id,
      title: String(title).trim(),
      price: parsePriceNumber(price),
      original_price: parsePriceNumber(original_price) || null,
      discount: discount ? String(discount) : '',
      currency: currency || 'Rp',
      rating: parseFloat(rating) || 5.0,
      sold_count: String(sold_count || ''),
      shop_name: String(shop_name || ''),
      shop_location: String(shop_location || ''),
      category: String(category || 'Umum'),
      product_url: String(product_url || ''),
      affiliate_url: String(affiliate_url || ''),
      description: String(description || ''),
      images: Array.isArray(images) ? images : [],
      videos: Array.isArray(videos) ? videos : [],
      media: unifiedMedia,
      variants: Array.isArray(variants) ? variants : [],
      notes: String(notes || ''),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const docRef = await db.collection('affiliate_products').add(newProduct);
    res.status(201).json({ success: true, product: { id: docRef.id, ...newProduct } });
  } catch (err) {
    console.error('Error creating product:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/affiliate-products/bulk
// Bulk import from Shopee Scraper exported JSON or raw product arrays
router.post('/bulk', async (req, res) => {
  try {
    const items = Array.isArray(req.body) ? req.body : (req.body.products || req.body.items || []);

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Daftar produk tidak boleh kosong.' });
    }

    // Fetch existing products for this user to check duplicates by product_url
    const existingSnap = await db.collection('affiliate_products')
      .where('user_id', '==', req.user.id)
      .get();
    
    const existingUrlMap = new Map();
    existingSnap.docs.forEach(doc => {
      const d = doc.data();
      if (d.product_url) {
        existingUrlMap.set(d.product_url.trim(), doc.id);
      }
    });

    const savedProducts = [];
    const batch = db.batch();
    const now = new Date().toISOString();

    for (const rawItem of items) {
      // Normalize Shopee Scraper format vs Medsos Agent format
      const formatted = rawItem.formatted || rawItem.rawFormatted || rawItem;
      const raw = rawItem.raw || {};

      const title = formatted['Product Name'] || rawItem.title || raw.name || raw.title || 'Untitled Product';
      const rawPrice = formatted['Price'] || rawItem.price || raw.price || 0;
      const rawOrigPrice = formatted['Price Before Discount'] || rawItem.original_price || raw.price_before_discount || null;
      const discount = formatted['Discount'] || rawItem.discount || '';

      const ratingStar = formatted['Rating Star'] || rawItem.rating || raw.item_rating?.rating_star || 5.0;
      const soldCount = formatted['Sold Count'] || formatted['Historical Sold'] || rawItem.sold_count || raw.sold || raw.historical_sold || '';
      const shopName = rawItem.shop_name || formatted['Shop Name'] || raw.shop_name || raw.shop_data?.shop_name || raw.shop_info?.shop_name || '';
      const shopLocation = rawItem.shop_location || formatted['Shop Location'] || raw.shop_location || raw.shop_data?.shop_location || raw.shop_info?.shop_location || '';

      const rawItemId = formatted['Item ID'] || rawItem.id || rawItem.item_id || raw.itemid || raw.item_id || '';
      const rawShopId = formatted['Shop ID'] || rawItem.shop_id || raw.shopid || raw.shop_id || raw.shop_data?.shop_id || '';

      let productUrl = rawItem.product_url || formatted['Product URL'] || rawItem.url || rawItem.productUrl || raw.itemurl || '';
      if (!productUrl || productUrl === 'Not Available' || productUrl === '-' || productUrl === 'undefined') {
        if (rawShopId && rawItemId) {
          productUrl = `https://shopee.co.id/product/${rawShopId}/${rawItemId}`;
        } else if (rawItemId) {
          productUrl = `https://shopee.co.id/product/0/${rawItemId}`;
        } else {
          productUrl = '';
        }
      }
      const affiliateUrl = rawItem.affiliate_url || '';
      const description = formatted['Description'] || rawItem.description || raw.description || '';
      const productVideo = formatted['Product Video'] || rawItem.product_video || rawItem.video || '';
      const brand = formatted['Brand'] || rawItem.brand || raw.brand || '';

      // Extract images (Max 5 HD images)
      let images = [];
      if (rawItem.images && Array.isArray(rawItem.images) && rawItem.images.length > 0) {
        images = rawItem.images.slice(0, 5);
      } else if (formatted['All Images']) {
        images = String(formatted['All Images']).split(' || ').map(s => s.trim()).filter(Boolean).slice(0, 5);
      } else if (raw.images && Array.isArray(raw.images)) {
        images = raw.images.map(img => img.startsWith('http') ? img : `https://down-id.img.susercontent.com/file/${img}`).slice(0, 5);
      } else if (rawItem.image) {
        images = [rawItem.image];
      }

      // Format videos
      let videos = [];
      if (productVideo) {
        videos = [productVideo];
      } else if (rawItem.videos && Array.isArray(rawItem.videos)) {
        videos = rawItem.videos;
      }

      // Build unified media array
      let media = [];
      if (Array.isArray(rawItem.media) && rawItem.media.length > 0) {
        media = rawItem.media;
      } else {
        videos.forEach(v => {
          if (v) media.push({ type: 'video', url: typeof v === 'string' ? v : v.url });
        });
        images.forEach(img => {
          if (img) media.push({ type: 'image', url: typeof img === 'string' ? img : img.url });
        });
      }

      // Variants
      let variants = [];
      if (Array.isArray(rawItem.variants) && rawItem.variants.length > 0) {
        variants = rawItem.variants;
      } else {
        const colorOptions = formatted['Color Options'] ? String(formatted['Color Options']).split(' | ') : [];
        const sizeOptions = formatted['Size Options'] ? String(formatted['Size Options']).split(' | ') : [];
        colorOptions.forEach(c => {
          if (c && c !== 'Standard') variants.push({ name: c.trim(), type: 'color' });
        });
        sizeOptions.forEach(s => {
          if (s && s !== 'Standard') variants.push({ name: s.trim(), type: 'size' });
        });
      }

      // Notes
      let notes = rawItem.notes;
      if (!notes) {
        notes = `Diimpor otomatis dari Shopee Scraper${brand ? ` - Brand: ${brand}` : ''}`;
      }

      const cleanProductUrl = String(productUrl || '').trim();
      const existingDocId = cleanProductUrl ? existingUrlMap.get(cleanProductUrl) : null;
      
      const docRef = existingDocId 
        ? db.collection('affiliate_products').doc(existingDocId)
        : db.collection('affiliate_products').doc();

      const productData = {
        id: docRef.id,
        user_id: req.user.id,
        title: String(title).trim(),
        price: parsePriceNumber(rawPrice),
        original_price: parsePriceNumber(rawOrigPrice) || null,
        discount: String(discount || ''),
        currency: 'Rp',
        rating: parseFloat(ratingStar) || 5.0,
        sold_count: String(soldCount || 'Terjual'),
        shop_name: String(shopName || 'Shopee Store'),
        shop_location: String(shopLocation || 'Indonesia'),
        category: String(rawItem.category || formatted['Category'] || 'Shopee Affiliate'),
        product_url: cleanProductUrl,
        affiliate_url: String(affiliateUrl || ''),
        description: String(description || ''),
        images: images,
        videos: videos,
        media: media,
        variants: variants,
        notes: String(notes),
        updated_at: now
      };

      if (!existingDocId) {
        productData.created_at = now;
      }

      batch.set(docRef, productData, { merge: true });
      savedProducts.push(productData);
      if (cleanProductUrl) existingUrlMap.set(cleanProductUrl, docRef.id);
    }

    await batch.commit();

    res.status(201).json({
      success: true,
      message: `Berhasil menyinkronkan ${savedProducts.length} produk ke Produk Affiliate.`,
      imported_count: savedProducts.length,
      products: savedProducts
    });
  } catch (err) {
    console.error('Error bulk importing products:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/affiliate-products/:id
router.put('/:id', async (req, res) => {
  try {
    const docRef = db.collection('affiliate_products').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Produk tidak ditemukan.' });
    }

    const existing = doc.data();
    const {
      title,
      price,
      original_price,
      discount,
      currency,
      rating,
      sold_count,
      shop_name,
      shop_location,
      category,
      product_url,
      affiliate_url,
      description,
      images,
      videos,
      media,
      variants,
      notes
    } = req.body || {};

    const updatedData = {
      title: title !== undefined ? String(title).trim() : existing.title,
      price: price !== undefined ? parsePriceNumber(price) : existing.price,
      original_price: original_price !== undefined ? parsePriceNumber(original_price) : existing.original_price,
      discount: discount !== undefined ? String(discount) : existing.discount,
      currency: currency !== undefined ? String(currency) : existing.currency,
      rating: rating !== undefined ? parseFloat(rating) : existing.rating,
      sold_count: sold_count !== undefined ? String(sold_count) : existing.sold_count,
      shop_name: shop_name !== undefined ? String(shop_name) : existing.shop_name,
      shop_location: shop_location !== undefined ? String(shop_location) : existing.shop_location,
      category: category !== undefined ? String(category) : existing.category,
      product_url: product_url !== undefined ? String(product_url) : existing.product_url,
      affiliate_url: affiliate_url !== undefined ? String(affiliate_url) : existing.affiliate_url,
      description: description !== undefined ? String(description) : existing.description,
      images: images !== undefined ? images : existing.images,
      videos: videos !== undefined ? videos : existing.videos,
      media: media !== undefined ? media : existing.media,
      variants: variants !== undefined ? variants : existing.variants,
      notes: notes !== undefined ? String(notes) : existing.notes,
      updated_at: new Date().toISOString()
    };

    await docRef.update(updatedData);

    res.json({ success: true, product: { id: doc.id, ...existing, ...updatedData } });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/affiliate-products/:id
router.delete('/:id', async (req, res) => {
  try {
    const docRef = db.collection('affiliate_products').doc(req.params.id);
    const doc = await docRef.get();

    if (!doc.exists || doc.data().user_id !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Produk tidak ditemukan.' });
    }

    await docRef.delete();
    res.json({ success: true, message: 'Produk berhasil dihapus.' });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
