/**
 * Test Script: Pembuat Link Afiliasi Shopee & Simpan ke Database Firestore
 */
require('dotenv').config();
const { db } = require('./config/firebase');
const { buildAffiliateLink } = require('./routes/affiliate');

async function testAffiliateLinkGenerationAndSave() {
  console.log('=== 🧪 MENJALANKAN TEST PEMBUATAN & PENYIMPANAN LINK AFILIASI KE FIRESTORE ===\n');

  try {
    // 1. Ambil 1 produk dari Firestore affiliate_products
    const snapshot = await db.collection('affiliate_products').limit(1).get();

    let product = null;
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      product = { id: doc.id, ...doc.data() };
      console.log('1. Menggunakan Produk dari Database:');
      console.log('   - ID Produk  :', product.id);
      console.log('   - Judul      :', product.title);
      console.log('   - URL Asli   :', product.product_url || product.affiliate_url);
    } else {
      product = {
        id: 'shopee_prod_demo',
        title: 'TWS Gaming Low Latency 5.3 Bluetooth Earphone',
        product_url: 'https://shopee.co.id/product/12345678/987654321',
        price: 129000
      };
    }

    const affiliateId = process.env.SHOPEE_AFFILIATE_ID || '11328861338';
    const now = new Date().toISOString();

    // Buat dan simpan r_test_fa (Facebook) dan r_test_th (Threads)
    const testCases = [
      { code: 'r_test_fa', platform: 'facebook' },
      { code: 'r_test_th', platform: 'threads' },
      { code: 'r_demo_shopee', platform: 'facebook' },
    ];

    console.log('\n2. Menyimpan Link Afiliasi Langsung ke Firestore short_links:');

    for (const item of testCases) {
      const tracking = {
        source: item.platform,
        campaign: 'auto_agent',
        content: product.id,
        custom_1: 'medsos_agent'
      };

      const rawUrl = product.product_url || product.affiliate_url || 'https://shopee.co.id';
      const destinationUrl = buildAffiliateLink(rawUrl, tracking, affiliateId);
      const publicUrl = process.env.PUBLIC_URL || 'https://shopee-link-aff.vercel.app';
      const shortUrl = `${publicUrl}/s/${item.code}`;

      // Simpan langsung ke Firestore agar bisa diklik di browser
      await db.collection('short_links').doc(item.code).set({
        code: item.code,
        user_id: product.user_id || 'system',
        product_id: product.id,
        title: product.title || 'Shopee Product',
        product_url: rawUrl,
        destination_url: destinationUrl,
        platform: item.platform,
        tracking: tracking,
        total_clicks: 0,
        human_clicks: 0,
        bot_clicks: 0,
        created_at: now,
        updated_at: now
      });

      console.log(`\n   ✅ [Shortlink: ${item.code}]`);
      console.log('   - URL yang bisa dibuka sekarang di browser:');
      console.log('     ', shortUrl);
      console.log('   - Target Pengalihan Shopee Affiliate:');
      console.log('     ', destinationUrl);
    }

    console.log('\n=== 🎉 LINK AFILIASI SUDAH TERSIMPAN DI DATABASE FIRESTORE (SIAP DIKLIK) ===');

  } catch (err) {
    console.error('Error:', err);
  }
}

testAffiliateLinkGenerationAndSave();
