const { classifyCommentIntent } = require('../services/threads/inbound/intentClassifier');
const { composeReply } = require('../services/threads/publishing/replyComposer');
const { cleanCaptionText } = require('../services/agent/copywritingService');
const { processSingleInboundReply } = require('../services/threads/inbound/inboundDecisionEngine');

async function runTests() {
  console.log('========================================================================');
  console.log('RUNNING DEEP VERIFICATION TESTS FOR THREADS AUTO-MARKETING FIXES');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  // TEST 1: Hashtag Deduplication
  console.log('--- TEST 1: Hashtag Deduplication ---');
  const sampleCaption = `Buat yang nanya spill belinya di mana, link tokonya ada di sini ya:
https://shopee-link-aff.vercel.app/s/r_f123

#RacunShopee #ShopeeAffiliate #ShopeeAffiliate #ShopeeAffiliate`;
  const cleanedCaption = cleanCaptionText(sampleCaption);
  console.log('Original:\n' + sampleCaption);
  console.log('\nCleaned:\n' + cleanedCaption);

  const affiliateCount = (cleanedCaption.match(/#ShopeeAffiliate/gi) || []).length;
  if (affiliateCount === 1) {
    console.log('✅ TEST 1 PASSED: Hashtags properly deduplicated to 1 instance.\n');
    passed++;
  } else {
    console.error(`❌ TEST 1 FAILED: Expected 1 instance of #ShopeeAffiliate, found ${affiliateCount}\n`);
    failed++;
  }

  // TEST 2: Price Inquiry Intent Classification
  console.log('--- TEST 2: Intent Classification for Price Inquiries ---');
  const priceTestComments = [
    'cantik banget, spill harga',
    'spill harga min',
    'harganya berapa kak?',
    'berapaan nih?',
    'spill link dong',
  ];

  for (const comment of priceTestComments) {
    const result = await classifyCommentIntent(comment);
    console.log(`Comment: "${comment}" -> Intent: ${result.intent} (${result.confidence})`);
  }

  const spillHargaIntent = await classifyCommentIntent('cantik banget, spill harga');
  if (spillHargaIntent.intent === 'PRICE_INQUIRY') {
    console.log('✅ TEST 2 PASSED: "spill harga" accurately classified as PRICE_INQUIRY.\n');
    passed++;
  } else {
    console.error(`❌ TEST 2 FAILED: Expected PRICE_INQUIRY, got ${spillHargaIntent.intent}\n`);
    failed++;
  }

  // TEST 3: Price-Aware Reply Generation
  console.log('--- TEST 3: Price-Aware Reply Generation ---');
  const priceReply = composeReply({
    style: 'helpful',
    affiliateUrl: 'https://shopee-link-aff.vercel.app/s/r_f123',
    productTitle: 'Tas Selempang Wanita Elegan',
    price: 85000,
    authorUsername: 'imveeveena',
    intent: 'PRICE_INQUIRY',
  });
  console.log('Generated Price Reply:\n' + priceReply);
  if (priceReply.includes('Rp 85.000') && priceReply.includes('https://shopee-link-aff.vercel.app/s/r_f123')) {
    console.log('✅ TEST 3 PASSED: Price reply includes formatted Rupiah and working link.\n');
    passed++;
  } else {
    console.error('❌ TEST 3 FAILED: Reply did not contain expected price or URL.\n');
    failed++;
  }

  // TEST 4: Multi-Account Exclusion & Whitelist
  console.log('--- TEST 4: Multi-Account Exclusion & Whitelist ---');
  const ownedUsernames = new Set(['imveeveena', 'ladynetaa', 'kana_netaaa', 'zilla_hida', 'cleodeneta']);
  
  // Case A: imveeveena on ladynetaa (Whitelisted for testing)
  const imveeveenaResult = await processSingleInboundReply({
    reply: { id: 'rep_123', username: 'imveeveena', text: 'cantik banget, spill harga' },
    threadId: 'th_456',
    account: { id: 'acc_lady', page_name: 'ladynetaa', username: 'ladynetaa', access_token: 'fake_token' },
    userId: 'user_1',
    ownedUsernames,
  });
  console.log('Case A (imveeveena on ladynetaa):', imveeveenaResult);

  // Case B: cleodeneta on ladynetaa (Non-whitelisted sister account -> Should be ignored)
  const cleoResult = await processSingleInboundReply({
    reply: { id: 'rep_456', username: 'cleodeneta', text: 'cantik banget, spill harga' },
    threadId: 'th_456',
    account: { id: 'acc_lady', page_name: 'ladynetaa', username: 'ladynetaa', access_token: 'fake_token' },
    userId: 'user_1',
    ownedUsernames,
  });
  console.log('Case B (cleodeneta on ladynetaa):', cleoResult);

  if (cleoResult.reason?.includes('internal sister') && (imveeveenaResult.reason || '').includes('Tidak ditemukan data context produk')) {
    console.log('✅ TEST 4 PASSED: @imveeveena passed account filter for testing, while @cleodeneta was properly blocked.\n');
    passed++;
  } else {
    console.error('❌ TEST 4 FAILED: Whitelist filter behavior did not match expectations.\n');
    failed++;
  }

  console.log('========================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Error running tests:', err);
  process.exit(1);
});
