/**
 * Test Suite: Threads Post Tanpa Media (Link Card Preview Mode)
 * Tests copywriting, media evaluator, templates, and posting flow for Threads no-media support.
 */

const { generatePostContent } = require('../services/agent/copywritingService');
const { curateProductMedia, calculateProductMediaHealth } = require('../services/agent/mediaEvaluatorService');
const { getSeedTemplates } = require('../services/agent/templateService');
const { postToThreads, formatThreadsText } = require('../services/threadsService');

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING THREADS NO-MEDIA (LINK CARD) TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  const sampleProduct = {
    id: 'prod_test_threads_123',
    title: 'Gantungan Kunci Viral Anime Lucu Shopee',
    affiliate_url: 'https://shopee-link-aff.vercel.app/s/r_test123',
    clean_media_urls: ['https://example.com/image1.jpg'],
    features: ['Akrilik tebal 3mm', 'Double side print', 'Gantungan stainless anti karat'],
    benefits: ['Awet tahan lama', 'Tampil lucu dan aesthetic'],
    niche: 'FASHION',
    price: 25000,
    pain_points: ['Gantungan kunci biasa gampang copot dan pudar'],
    target_persona: 'Remaja dan Pecinta Anime'
  };

  // TEST 1: Copywriting Engine in Threads No-Media Mode
  console.log('--- TEST 1: Copywriting Engine (Threads No-Media) ---');
  try {
    const copyResult = await generatePostContent({
      product: sampleProduct,
      platform: 'threads',
      threadsMediaMode: 'no_media'
    });

    assert(Boolean(copyResult.caption), 'Caption generated successfully');
    assert(copyResult.caption.includes('shopee-link-aff.vercel.app/s/r_test123'), 'Caption contains affiliate shortlink directly');
    assert(copyResult.first_reply_text === '' || !copyResult.first_reply_text, 'First reply is omitted (empty) for no-media mode');
    assert(copyResult.cta_type === 'link_card_cta', 'CTA type is link_card_cta');
    assert(copyResult.caption.length <= 500, `Caption fits within 500 chars limit (length: ${copyResult.caption.length})`);
    console.log(`Generated Caption Sample:\n"""\n${copyResult.caption}\n"""\n`);
  } catch (err) {
    assert(false, `Copywriting engine threw error: ${err.message}`);
  }

  // TEST 2: Copywriting Engine in Threads Standard (With Media) Mode
  console.log('--- TEST 2: Copywriting Engine (Threads With Media) ---');
  try {
    const copyResultWithMedia = await generatePostContent({
      product: sampleProduct,
      platform: 'threads',
      threadsMediaMode: 'with_media'
    });

    assert(Boolean(copyResultWithMedia.caption), 'Caption generated with media mode');
    assert(copyResultWithMedia.first_reply_text.includes('shopee-link-aff.vercel.app/s/r_test123'), 'First reply contains affiliate shortlink for standard media mode');
  } catch (err) {
    assert(false, `Copywriting with media threw error: ${err.message}`);
  }

  // TEST 3: Media Evaluator in Threads No-Media Mode
  console.log('\n--- TEST 3: Media Evaluator (Threads No-Media Curate) ---');
  try {
    const curatedNoMedia = await curateProductMedia(sampleProduct, 'auto', 'threads', 'user_test', { threadsMediaMode: 'no_media' });
    assert(curatedNoMedia.media_type === 'text', `Curated media type is "text" (got: ${curatedNoMedia.media_type})`);
    assert(Array.isArray(curatedNoMedia.selected_media) && curatedNoMedia.selected_media.length === 0, 'Selected media array is empty');
    assert(curatedNoMedia.no_fresh_media === false, 'no_fresh_media flag is false (does not block posting)');
  } catch (err) {
    assert(false, `Media evaluator curate threw error: ${err.message}`);
  }

  // TEST 4: Media Evaluator Health Check for Threads
  console.log('\n--- TEST 4: Media Health Check for Threads ---');
  try {
    const productWithoutMedia = { ...sampleProduct, images: [], videos: [], media: [], used_media_by_platform: {} };
    const healthSummary = calculateProductMediaHealth(productWithoutMedia);
    assert(healthSummary.threads?.can_post_no_media === true, 'Threads product without media can still post (can_post_no_media is true)');
    assert(healthSummary.threads?.can_post === true, 'Product is marked can_post on Threads');
    assert(healthSummary.threads?.status === 'link_preview_ready', `Threads status is link_preview_ready (got: ${healthSummary.threads?.status})`);
    assert(healthSummary.facebook?.can_post === false, 'Facebook product without media cannot post');
  } catch (err) {
    assert(false, `Media health check threw error: ${err.message}`);
  }

  // TEST 5: Native Threads Seed Templates for Link Card
  console.log('\n--- TEST 5: Template Service Seed Templates ---');
  try {
    const { SEED_TEMPLATES } = require('../services/agent/templateService');
    const threadsTemplates = SEED_TEMPLATES.filter(t => t.platform_fit?.includes('threads'));
    const linkCardTpl = threadsTemplates.find(t => t.id === 'tpl_threads_link_preview_12');
    const valueCardTpl = threadsTemplates.find(t => t.id === 'tpl_threads_value_card_13');

    assert(Boolean(linkCardTpl), 'Found tpl_threads_link_preview_12 template');
    assert(Boolean(valueCardTpl), 'Found tpl_threads_value_card_13 template');
    assert(linkCardTpl.structure.includes('{CTA_LINK}'), 'Template contains {CTA_LINK} placeholder for caption embed');
  } catch (err) {
    assert(false, `Template service test threw error: ${err.message}`);
  }

  // TEST 6: formatThreadsText URL Preservation
  console.log('\n--- TEST 6: formatThreadsText URL Preservation ---');
  try {
    const sampleLink = 'https://shopee-link-aff.vercel.app/s/r_test123';
    const longTextWithUrl = 'Halo guys, ini adalah rekomendasi produk paling mantap yang wajib kalian coba sekarang juga! '.repeat(10) + '\n' + sampleLink;
    const formatted = formatThreadsText(longTextWithUrl, 495);

    assert(formatted.length <= 495, `Formatted text length is <= 495 (actual: ${formatted.length})`);
    assert(formatted.includes(sampleLink), 'Affiliate link was preserved during truncation');
  } catch (err) {
    assert(false, `formatThreadsText threw error: ${err.message}`);
  }

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
