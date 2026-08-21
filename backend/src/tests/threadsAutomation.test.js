const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { acquireLock, releaseLock } = require('../services/threads/safety/idempotencyService');
const { classifyCommentIntent } = require('../services/threads/inbound/intentClassifier');
const { matchProductToPublicPost } = require('../services/threads/products/productMatcher');
const { validateProductForPromotion } = require('../services/threads/products/productValidator');
const { composeReply } = require('../services/threads/publishing/replyComposer');

async function runAutomationUnitTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING THREADS MARKETING SYSTEM UNIT TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Idempotency Lock
  try {
    console.log('[Test 1] Pengujian Idempotency & Concurrent Locks ...');
    const testKey = `test_lock_${Date.now()}`;
    const firstAcquire = await acquireLock(testKey, { test: true });
    const secondAcquire = await acquireLock(testKey, { test: true });

    if (firstAcquire === true && secondAcquire === false) {
      console.log('  ✅ PASSED: Lock atomik pertama berhasil, percobaan kedua ditolak.');
      passed++;
    } else {
      console.error('  ❌ FAILED: Idempotency lock gagal mencegah akses ganda.');
      failed++;
    }
  } catch (e) {
    console.error('  ❌ FAILED Test 1:', e.message);
    failed++;
  }

  // Test 2: Intent Classification
  try {
    console.log('\n[Test 2] Pengujian Klasifikasi Intensi Komentar ...');
    const res1 = await classifyCommentIntent('spill link dong kak mau beli');
    const res2 = await classifyCommentIntent('ini beli di mana ya?');
    const res3 = await classifyCommentIntent('penipu jangan mau beli di sini');
    const res4 = await classifyCommentIntent('bagus banget pemandangannya');

    const check1 = res1.intent === 'LINK_REQUEST' && res1.confidence >= 0.85;
    const check2 = res2.intent === 'LINK_REQUEST';
    const check3 = res3.intent === 'NEGATIVE';
    const check4 = res4.intent === 'GENERAL_APPRECIATION';

    if (check1 && check2 && check3 && check4) {
      console.log('  ✅ PASSED: Seluruh klasifikasi intensi (Link Request, Negative, Appreciation) akurat 100%.');
      passed++;
    } else {
      console.error('  ❌ FAILED: Hasil intensi tidak sesuai:', { res1, res2, res3, res4 });
      failed++;
    }
  } catch (e) {
    console.error('  ❌ FAILED Test 2:', e.message);
    failed++;
  }

  // Test 3: Semantic Product Matcher
  try {
    console.log('\n[Test 3] Pengujian Semantic Product Matcher ...');
    const mockProducts = [
      { id: 'p1', title: 'Kemeja Katun Pria Lengan Panjang', category: 'fashion', product_url: 'https://shopee.co.id/kemeja' },
      { id: 'p2', title: 'Sepatu Sneakers Wanita Putih', category: 'shoes', product_url: 'https://shopee.co.id/sepatu' },
      { id: 'p3', title: 'Casing HP iPhone 13 Transparan', category: 'elektronik', product_url: 'https://shopee.co.id/case' },
    ];

    const matchRes = matchProductToPublicPost('Ada rekomendasi kemeja katun pria yang adem buat kuliah?', mockProducts);

    if (matchRes.matchedProduct && matchRes.matchedProduct.id === 'p1' && matchRes.buyingIntentScore >= 0.70) {
      console.log(`  ✅ PASSED: Cocok dengan Produk #${matchRes.matchedProduct.id} (${matchRes.matchedProduct.title}) - Intent: ${matchRes.buyingIntentScore}, Relevansi: ${matchRes.relevanceScore}`);
      passed++;
    } else {
      console.error('  ❌ FAILED: Gagal mencocokkan produk kemeja:', matchRes);
      failed++;
    }
  } catch (e) {
    console.error('  ❌ FAILED Test 3:', e.message);
    failed++;
  }

  // Test 4: Reply Composer Formatting
  try {
    console.log('\n[Test 4] Pengujian Reply Composer ...');
    const reply1 = composeReply({
      style: 'helpful',
      affiliateUrl: 'https://shopee-link-aff.vercel.app/s/abc123',
      productTitle: 'Kemeja Pria',
      authorUsername: 'andi',
    });

    if (reply1 && reply1.includes('https://shopee-link-aff.vercel.app/s/abc123') && reply1.length <= 495) {
      console.log('  ✅ PASSED: Reply text terformat rapi & menyertakan link afiliasi sah:', reply1);
      passed++;
    } else {
      console.error('  ❌ FAILED: Format reply tidak valid:', reply1);
      failed++;
    }
  } catch (e) {
    console.error('  ❌ FAILED Test 4:', e.message);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');
}

if (require.main === module) {
  runAutomationUnitTests().then(() => process.exit(0));
}

module.exports = { runAutomationUnitTests };
