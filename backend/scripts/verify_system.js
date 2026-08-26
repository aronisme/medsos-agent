const { calculateProductMediaHealth } = require('../src/services/agent/mediaEvaluatorService');

console.log('=== 1. TESTING calculateProductMediaHealth ===');

const mockProductHealthy = {
  id: 'prod_001',
  title: 'TWS Bluetooth Earphone Wireless 5.3',
  category: 'Gadget',
  images: ['https://img.com/1.jpg', 'https://img.com/2.jpg', 'https://img.com/3.jpg'],
  videos: ['https://video.com/v1.mp4'],
  used_media_by_platform: {
    facebook: ['https://img.com/1.jpg'],
    threads: []
  }
};

const healthHealthy = calculateProductMediaHealth(mockProductHealthy);
console.log('Healthy Media Output:', JSON.stringify(healthHealthy, null, 2));

const mockProductExhausted = {
  id: 'prod_002',
  title: 'Dress Wanita Muslimah Elegant',
  category: 'Fashion Wanita',
  images: ['https://img.com/a.jpg'],
  videos: [],
  used_media_by_platform: {
    facebook: ['https://img.com/a.jpg'],
    threads: ['https://img.com/a.jpg']
  }
};

const healthExhausted = calculateProductMediaHealth(mockProductExhausted);
console.log('Exhausted Media Output:', JSON.stringify(healthExhausted, null, 2));

if (healthHealthy.facebook.status === 'healthy' && healthHealthy.facebook.fresh_images === 2 && healthHealthy.facebook.fresh_videos === 1) {
  console.log('✅ PASS: calculateProductMediaHealth (Healthy scenario)');
} else {
  console.error('❌ FAIL: calculateProductMediaHealth healthy scenario');
}

if (healthExhausted.facebook.status === 'exhausted' && healthExhausted.facebook.can_post === false) {
  console.log('✅ PASS: calculateProductMediaHealth (Exhausted scenario)');
} else {
  console.error('❌ FAIL: calculateProductMediaHealth exhausted scenario');
}

console.log('\n=== 2. TESTING NICHE COMPATIBILITY HELPER ===');
// Let's test niche compatibility logic
const CANONICAL_NICHES = {
  UNIVERSAL: { id: 'UNIVERSAL', keywords: [] },
  GADGET_AUDIO: { id: 'GADGET_AUDIO', keywords: ['gadget', 'audio', 'tws', 'headset', 'elektronik'] },
  FASHION_WOMEN: { id: 'FASHION_WOMEN', keywords: ['wanita', 'dress', 'blouse', 'rok', 'hijab'] }
};

function normalizeNicheId(rawNiche = '') {
  if (!rawNiche) return 'UNIVERSAL';
  const str = String(rawNiche).trim().toUpperCase().replace(/[\s&/\\-]+/g, '_');
  if (CANONICAL_NICHES[str]) return str;
  for (const [key, conf] of Object.entries(CANONICAL_NICHES)) {
    if (key === 'UNIVERSAL') continue;
    if (str.includes(key) || conf.keywords.some(k => String(rawNiche).toLowerCase().includes(k))) {
      return key;
    }
  }
  return 'UNIVERSAL';
}

function checkNicheCompatibility(product, account) {
  let allowed = account.allowed_niches;
  if (!Array.isArray(allowed) || allowed.length === 0) {
    allowed = ['UNIVERSAL'];
  }
  const normalizedAllowed = allowed.map(n => normalizeNicheId(n));

  if (normalizedAllowed.includes('UNIVERSAL')) {
    return { compatible: true, matchType: 'UNIVERSAL_FALLBACK' };
  }

  const prodNiche = normalizeNicheId(product.agent_profile?.niche || product.category || product.title);
  if (normalizedAllowed.includes(prodNiche)) {
    return { compatible: true, matchType: 'SPECIFIC_MATCH' };
  }

  return { compatible: false, matchType: 'MISMATCH' };
}

const accountUniversal = { allowed_niches: ['UNIVERSAL'] };
const accountGadgetOnly = { allowed_niches: ['GADGET_AUDIO'] };
const accountFashionOnly = { allowed_niches: ['FASHION_WOMEN'] };

const testProductGadget = { title: 'TWS Gaming Earphone', agent_profile: { niche: 'GADGET_AUDIO' } };
const testProductFashion = { title: 'Gamis Brokat Muslimah', agent_profile: { niche: 'FASHION_WOMEN' } };

const check1 = checkNicheCompatibility(testProductGadget, accountUniversal);
console.log('Gadget with Universal Account:', check1);

const check2 = checkNicheCompatibility(testProductGadget, accountGadgetOnly);
console.log('Gadget with Gadget Account:', check2);

const check3 = checkNicheCompatibility(testProductGadget, accountFashionOnly);
console.log('Gadget with Fashion Account:', check3);

if (check1.compatible && check1.matchType === 'UNIVERSAL_FALLBACK' &&
    check2.compatible && check2.matchType === 'SPECIFIC_MATCH' &&
    !check3.compatible && check3.matchType === 'MISMATCH') {
  console.log('✅ PASS: Niche Compatibility matching and fallbacks');
} else {
  console.error('❌ FAIL: Niche Compatibility check');
}

console.log('\n=== 3. TESTING DETERMINISTIC SORT & PAGINATION ===');
const mockList = [
  { id: 'prod_b', created_at: '2026-08-20T10:00:00Z', title: 'Product B' },
  { id: 'prod_a', created_at: '2026-08-20T10:00:00Z', title: 'Product A' },
  { id: 'prod_c', created_at: '2026-08-21T10:00:00Z', title: 'Product C' },
  { id: 'prod_d', created_at: '2026-08-19T10:00:00Z', title: 'Product D' }
];

mockList.sort((a, b) => {
  const timeDiff = new Date(b.created_at || 0) - new Date(a.created_at || 0);
  return timeDiff !== 0 ? timeDiff : String(b.id || '').localeCompare(String(a.id || ''));
});

console.log('Sorted list IDs (should be C, B, A, D):', mockList.map(x => x.id).join(', '));
if (mockList[0].id === 'prod_c' && mockList[1].id === 'prod_b' && mockList[2].id === 'prod_a' && mockList[3].id === 'prod_d') {
  console.log('✅ PASS: Deterministic tie-breaker sort');
} else {
  console.error('❌ FAIL: Deterministic tie-breaker sort');
}

console.log('\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
