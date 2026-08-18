/**
 * Test Generasi Link Afiliasi dari Produk Asli di Firestore
 */
require('dotenv').config();
const { db } = require('./config/firebase');
const { buildAffiliateLink } = require('./routes/affiliate');

async function testRealProductsAffiliate() {
  console.log('=== 🧪 MEMULAI TEST GENERASI LINK AFILIASI DARI PRODUK ASLI ===\n');

  try {
    // 1. Ambil produk dari koleksi affiliate_products
    const snapshot = await db.collection('affiliate_products').get();
    
    console.log(`Ditemukan total ${snapshot.size} produk di database Firestore:`);
    
    let validProducts = [];
    snapshot.docs.forEach((doc, idx) => {
      const p = { id: doc.id, ...doc.data() };
      const rawUrl = p.product_url || p.affiliate_url || '';
      console.log(`   [${idx + 1}] ID: ${p.id.slice(0, 10)}... | Judul: ${p.title.slice(0, 35)}... | URL: ${rawUrl ? rawUrl.slice(0, 45) + '...' : '(KOSONG)'}`);
      
      if (rawUrl && rawUrl.startsWith('http') && rawUrl !== 'https://shopee.co.id') {
        validProducts.push(p);
      }
    });

    // Jika belum ada yang memiliki URL lengkap, kita ambil 1 produk dan pasang URL Shopee asli
    let targetProduct = validProducts[0];
    if (!targetProduct && snapshot.size > 0) {
      const firstDoc = snapshot.docs[0];
      targetProduct = { id: firstDoc.id, ...firstDoc.data() };
      // Pasang URL Shopee asli untuk produk ini
      const sampleRealUrl = 'https://shopee.co.id/product/432924141/10419382914';
      await db.collection('affiliate_products').doc(firstDoc.id).update({
        product_url: sampleRealUrl,
        updated_at: new Date().toISOString()
      });
      targetProduct.product_url = sampleRealUrl;
      console.log(`\n💡 Memperbarui produk #${firstDoc.id} dengan URL Shopee Asli: ${sampleRealUrl}`);
    }

    if (!targetProduct) {
      targetProduct = {
        id: 'real_shopee_001',
        title: 'Sepatu Flats Wanita Princess Flatshoes Murmer',
        product_url: 'https://shopee.co.id/product/432924141/10419382914',
        price: 17845
      };
    }

    console.log('\n2. Memilih Produk untuk Testing:');
    console.log('   - ID Produk    :', targetProduct.id);
    console.log('   - Judul        :', targetProduct.title);
    console.log('   - URL Asli     :', targetProduct.product_url);
    console.log('   - Harga        : Rp', Number(targetProduct.price || 0).toLocaleString('id-ID'));

    // 3. Generate Link Afiliasi Resmi & Shortlink
    const affiliateId = process.env.SHOPEE_AFFILIATE_ID || '11328861338';
    const now = new Date().toISOString();

    const testRuns = [
      { code: 'r_asli_fb', platform: 'facebook' },
      { code: 'r_asli_th', platform: 'threads' }
    ];

    console.log('\n3. Menghasilkan Link Afiliasi & Menyimpan ke Database:');

    for (const test of testRuns) {
      const tracking = {
        source: test.platform,
        campaign: 'auto_agent',
        content: targetProduct.id,
        custom_1: 'medsos_agent'
      };

      const affiliateDestination = buildAffiliateLink(targetProduct.product_url, tracking, affiliateId);
      const publicUrl = process.env.PUBLIC_URL || 'https://shopee-link-aff.vercel.app';
      const shortUrl = `${publicUrl}/s/${test.code}`;

      await db.collection('short_links').doc(test.code).set({
        code: test.code,
        user_id: targetProduct.user_id || 'system',
        product_id: targetProduct.id,
        title: targetProduct.title,
        product_url: targetProduct.product_url,
        destination_url: affiliateDestination,
        platform: test.platform,
        tracking: tracking,
        total_clicks: 0,
        human_clicks: 0,
        bot_clicks: 0,
        created_at: now,
        updated_at: now
      });

      console.log(`\n   📌 [Platform: ${test.platform.toUpperCase()}]`);
      console.log('   - Shortlink Publik di Caption:');
      console.log('     ', shortUrl);
      console.log('   - Shopee Affiliate Destination (dengan origin_link produk asli):');
      console.log('     ', affiliateDestination);
    }

    console.log('\n=== 🎉 TEST SELESAI: LINK AFILIASI DARI PRODUK ASLI SIAP DIUJI DI BROWSER ===');

  } catch (err) {
    console.error('Error saat test:', err);
  }
}

testRealProductsAffiliate();
