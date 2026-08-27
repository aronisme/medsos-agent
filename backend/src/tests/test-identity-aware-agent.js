const { extractNaturalReference, cleanCaptionText, buildSystemPrompt } = require('../services/agent/copywritingService');
const { detectRobotClichés, validateCrossAccountContentDiversity, calculateCompositeSimilarity } = require('../services/agent/contentFingerprint');
const { PERSONA_DEFINITIONS, ARCHETYPE_DEFINITIONS, selectContentStrategyByBandit } = require('../services/agent/templateService');
const { curateProductMedia, getUsedMediaForPlatform } = require('../services/agent/mediaEvaluatorService');
const { canonicalizePersona, CANONICAL_PERSONAS } = require('../routes/accounts');

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING IDENTITY-AWARE CONTENT AGENT & ISOLATION TEST SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, name, details = '') {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      if (details) console.error(`     Details: ${details}`);
    }
  }

  // -------------------------------------------------------------
  // TEST A: Natural Product Reference Extraction
  // -------------------------------------------------------------
  console.log('▶️ [TEST A] Natural Product Reference Extraction');
  const ref1 = extractNaturalReference('[MALL ORI] Sandal Flatshoes Wanita Casual Slip On Korea 100% Original', 'Fashion Wanita');
  assert(ref1.includes('flatshoes') || ref1.includes('sandal'), 'Extracts "flatshoes ini" / "sandal ini"', `Got: "${ref1}"`);

  const ref2 = extractNaturalReference('Cardigan Rajut Crop Wanita Viral TikTok Shopee Termurah', 'Fashion Wanita');
  assert(ref2.includes('cardigan'), 'Extracts "cardigan ini"', `Got: "${ref2}"`);

  const ref3 = extractNaturalReference('Wadah Sabun Pump Otomatis Tempat Sabun Cuci Piring Dapur', 'Home Living');
  assert(ref3.includes('wadah') || ref3.includes('tempat sabun'), 'Extracts "wadah ini" / "tempat sabun ini"', `Got: "${ref3}"`);

  const ref4 = extractNaturalReference('TWS Wireless Bluetooth 5.3 Earphone Headset Bass', 'Gadget');
  assert(ref4.includes('tws') || ref4.includes('earphone') || ref4.includes('headset'), 'Extracts "tws ini" / "earphone ini"', `Got: "${ref4}"`);

  // -------------------------------------------------------------
  // TEST B: Two-Layer Anti-Robot Detector
  // -------------------------------------------------------------
  console.log('\n▶️ [TEST B] Two-Layer Anti-Robot Detector');
  const robotText1 = 'Ini dia solusi terbaiknya: Sepatu Sneakers!\nKeunggulan produk:\n• Nyaman\n• Murah\n• Bagus\nKenapa harus checkout sekarang? Karena promo!';
  const check1 = detectRobotClichés(robotText1);
  assert(check1.is_robot === true && check1.reasons.length >= 2, 'Detects Layer 1 clichés ("Solusi terbaiknya", "Keunggulan produk", "Kenapa harus checkout")', JSON.stringify(check1.reasons));

  const robotText2 = 'Produk keren banget\n• Poin 1\n• Poin 2\n• Poin 3\n• Poin 4';
  const check2 = detectRobotClichés(robotText2);
  assert(check2.is_robot === true && check2.reasons.some(r => r.includes('bullet point robotik')), 'Detects Layer 2 rigid bullet outline', JSON.stringify(check2.reasons));

  const humanText = 'IN THIS ECONOMY ‼️ nemu flatshoes yang vibesnya keliatan mewah tapi harganya murah kebangetan, cakep parah 🤌✨';
  const check3 = detectRobotClichés(humanText);
  assert(check3.is_robot === false, 'Passes natural human organic text', JSON.stringify(check3.reasons));

  // -------------------------------------------------------------
  // TEST C: Persona & Archetype Strategy Bandit
  // -------------------------------------------------------------
  console.log('\n▶️ [TEST C] Persona & Archetype Strategy Engine');
  const bestieStrategy = await selectContentStrategyByBandit({
    platform: 'threads',
    personaId: 'bestie_hype',
    niche: 'Fashion Wanita',
    objective: 'clicks'
  });
  assert(bestieStrategy.persona.id === 'bestie_hype', 'Selects bestie_hype persona correctly', bestieStrategy.persona.id);
  assert(['emotional_reaction', 'value_shock', 'witty_question', 'honest_spill'].includes(bestieStrategy.archetype.id), 'Selects archetype aligned with bestie_hype preferences', bestieStrategy.archetype.id);

  const aestheticStrategy = await selectContentStrategyByBandit({
    platform: 'threads',
    personaId: 'aesthetic_minimalist',
    niche: 'Fashion Wanita',
    objective: 'clicks'
  });
  assert(aestheticStrategy.persona.id === 'aesthetic_minimalist', 'Selects aesthetic_minimalist persona correctly', aestheticStrategy.persona.id);
  assert(['aesthetic_wishlist', 'honest_spill', 'pov_lifehack'].includes(aestheticStrategy.archetype.id), 'Selects archetype aligned with aesthetic_minimalist preferences', aestheticStrategy.archetype.id);

  // -------------------------------------------------------------
  // TEST D: Direct Copywriting System Prompt Builder
  // -------------------------------------------------------------
  console.log('\n▶️ [TEST D] Direct Copywriting Prompt Construction');
  const prompt = buildSystemPrompt({
    platform: 'threads',
    persona: PERSONA_DEFINITIONS.bestie_hype,
    archetype: ARCHETYPE_DEFINITIONS.emotional_reaction
  });
  assert(prompt.includes('Bestie Hype') && prompt.includes('MAAF TERIAK') && prompt.includes('ANTI-ROBOT'), 'System prompt contains persona rules, archetype instructions, and anti-robot laws', 'Prompt built successfully');

  // -------------------------------------------------------------
  // TEST E: 3-Space Cross-Account Content Fingerprint & Diversity
  // -------------------------------------------------------------
  console.log('\n▶️ [TEST E] 3-Space Cross-Account Diversity Validation');
  const draftA = {
    caption: 'IN THIS ECONOMY nemu flatshoes mall ori harga murah parah 🤌✨',
    hook_text: 'IN THIS ECONOMY',
    cta_text: 'detail di reply ya'
  };
  const identicalDraft = {
    caption: 'IN THIS ECONOMY nemu flatshoes mall ori harga murah parah 🤌✨',
    hook_text: 'IN THIS ECONOMY',
    cta_text: 'detail di reply ya'
  };
  const diverseDraft = {
    caption: 'Kalau kamu cari flatshoes yang nyaman dipakai seharian buat kerja, ini beneran clean look dan empuk banget 🤍',
    hook_text: 'Flatshoes clean look',
    cta_text: 'rekomendasi terbaik'
  };

  // Test space 1: Current Batch conflict
  const divCheck1 = validateCrossAccountContentDiversity({
    newDraft: identicalDraft,
    currentBatchDrafts: [draftA],
    threshold: 0.65
  });
  assert(divCheck1.passed === false && divCheck1.conflict_space === 'CURRENT_BATCH', 'Flags identical draft in CURRENT_BATCH space', `Sim: ${divCheck1.highest_similarity}%`);

  // Test diverse draft across spaces
  const divCheck2 = validateCrossAccountContentDiversity({
    newDraft: diverseDraft,
    currentBatchDrafts: [draftA],
    userScheduledPosts: [{ content: 'promo besar besaran tas wanita' }],
    userRecentMemories: [{ context_at_post: { caption_preview: 'review sandal viral' } }],
    threshold: 0.65
  });
  assert(divCheck2.passed === true, 'Accepts diverse draft across all 3 spaces', `Sim: ${divCheck2.highest_similarity}%`);

  // -------------------------------------------------------------
  // TEST F: Multi-Account Real-Time Media Isolation
  // -------------------------------------------------------------
  console.log('\n▶️ [TEST F] Multi-Account Real-Time Media Isolation');
  const mockProduct = {
    id: 'prod_999_shoes',
    title: 'Sepatu Flatshoes Wanita',
    images: [
      'https://cf.shopee.co.id/file/image_01.jpg',
      'https://cf.shopee.co.id/file/image_02.jpg',
      'https://cf.shopee.co.id/file/image_03.jpg',
      'https://cf.shopee.co.id/file/image_04.jpg'
    ],
    used_media_by_platform: {
      facebook: ['https://cf.shopee.co.id/file/image_01.jpg']
    },
    used_media_by_account: {
      acc_threads_1: ['https://cf.shopee.co.id/file/image_02.jpg']
    }
  };

  // Account 1 on Threads curates media (excludes image_02 because used by acc_threads_1)
  const curationAcc1 = await curateProductMedia(mockProduct, 'auto', 'threads', 'test_user', {
    accountId: 'acc_threads_1'
  });
  assert(curationAcc1.selected_media.length > 0 && !curationAcc1.selected_media.some(m => m.url.includes('image_02.jpg')), 'Account 1 excludes media already used by Account 1', JSON.stringify(curationAcc1.selected_media));

  // Account 2 on Threads curates media during the same active cycle, reserving Account 1 selection in-memory
  const reservedUrls = new Set(curationAcc1.selected_media.map(m => m.url));
  const curationAcc2 = await curateProductMedia(mockProduct, 'auto', 'threads', 'test_user', {
    accountId: 'acc_threads_2',
    inMemoryReservedUrls: reservedUrls
  });

  const overlap = curationAcc2.selected_media.some(m => reservedUrls.has(m.url));
  assert(!overlap, 'Account 2 NEVER receives media reserved by Account 1 in the same cycle', `Acc1: ${JSON.stringify(Array.from(reservedUrls))}, Acc2: ${JSON.stringify(curationAcc2.selected_media.map(m => m.url))}`);

  // -------------------------------------------------------------
  // TEST G: Account REST API Persona Canonicalization
  // -------------------------------------------------------------
  console.log('\n▶️ [TEST G] Account REST API Persona Canonicalization');
  assert(canonicalizePersona('bestie_hype') === 'bestie_hype', 'Validates canonical persona "bestie_hype"');
  assert(canonicalizePersona('BESTIE_HYPE') === 'bestie_hype', 'Normalizes uppercase persona');
  assert(canonicalizePersona('invalid_persona_xyz') === 'ai_adaptive', 'Falls back invalid persona to "ai_adaptive"');
  assert(CANONICAL_PERSONAS.length === 9, 'Contains all 9 canonical personas');

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
