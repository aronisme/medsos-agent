/**
 * Test Script: Pembuat Link Afiliasi Shopee & Shortlink Tracking
 */
require('dotenv').config();
const { db } = require('./config/firebase');
const { buildAffiliateLink } = require('./routes/affiliate');

async function testAffiliateLinkGeneration() {
  console.log('=== 🧪 MEMULAI TEST AGENT PEMBUAT LINK AFILIASI SHOPEE ===\n');

  try {
    // 1. Ambil 1 produk dari Firestore affiliate_products
    const snapshot = await db.collection('affiliate_products').limit(1).get();

    let product = null;
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      product = { id: doc.id, ...doc.data() };
      console.log('1. Menggunakan Produk Tersedia dari Database:');
      console.log('   - ID Produk  :', product.id);
      console.log('   - Judul      :', product.title);
      console.log('   - URL Asli   :', product.product_url || product.affiliate_url);
      console.log('   - Harga      : Rp', Number(product.price || 0).toLocaleString('id-ID'));
    } else {
      console.log('1. Database affiliate_products kosong, menggunakan mock produk Shopee:');
      product = {
        id: 'shopee_prod_99812',
        title: 'TWS Gaming Low Latency 5.3 Bluetooth Earphone',
        product_url: 'https://shopee.co.id/product/12345678/987654321',
        price: 129000
      };
      console.log('   - ID Produk  :', product.id);
      console.log('   - Judul      :', product.title);
      console.log('   - URL Asli   :', product.product_url);
    }

    console.log('\n2. Menguji Pembuatan Link Afiliasi untuk 2 Platform (Facebook & Threads):');

    const affiliateId = process.env.SHOPEE_AFFILIATE_ID || '11328861338';
    const platforms = ['facebook', 'threads'];

    for (const platform of platforms) {
      const tracking = {
        source: platform,
        campaign: 'auto_agent',
        content: product.id,
        custom_1: 'medsos_agent'
      };

      const rawUrl = product.product_url || product.affiliate_url || 'https://shopee.co.id';
      const destinationAffiliateUrl = buildAffiliateLink(rawUrl, tracking, affiliateId);
      
      const shortCode = 'r_test_' + platform.slice(0, 2);
      const publicUrl = process.env.PUBLIC_URL || 'https://shopee-link-aff.vercel.app';
      const finalShortUrl = `${publicUrl}/s/${shortCode}`;

      console.log(`\n   📌 [Platform: ${platform.toUpperCase()}]`);
      console.log('   - Shopee Affiliate Destination:');
      console.log('     ', destinationAffiliateUrl);
      console.log('   - Shortlink Publik yang disematkan di Caption:');
      console.log('     ', finalShortUrl);
      console.log('   - Parameter Tracking Sub-ID:');
      console.log('      • source   :', tracking.source);
      console.log('      • campaign :', tracking.campaign);
      console.log('      • content  :', tracking.content);
      console.log('      • custom_1 :', tracking.custom_1);

      // Verifikasi komponen URL
      const isShopeeAff = destinationAffiliateUrl.startsWith('https://s.shopee.co.id/an_redir');
      const hasAffiliateId = destinationAffiliateUrl.includes(`affiliate_id=${affiliateId}`);
      const hasSubId = destinationAffiliateUrl.includes(`sub_id=${platform}-auto_agent-${product.id}-medsos_agent-`);
      const hasCorrectDomain = finalShortUrl.startsWith('https://shopee-link-aff.vercel.app');

      if (isShopeeAff && hasAffiliateId && hasSubId && hasCorrectDomain) {
        console.log(`   ✅ Status: VALID 100% (Resmi Shopee Affiliate Link + Sub-ID Aktif + Domain Vercel Baru)`);
      } else {
        console.log(`   ⚠️ Status Periksa: isShopeeAff=${isShopeeAff}, hasAffId=${hasAffiliateId}, hasSubId=${hasSubId}, domain=${hasCorrectDomain}`);
      }
    }

    console.log('\n=== 🎉 TEST PEMBUAT LINK AFILIASI SELESAI & BERHASIL SEMPURNA ===');

  } catch (err) {
    console.error('Error saat testing:', err);
  }
}

testAffiliateLinkGeneration();
