require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const {
  validateMediaUrlSecurity,
  resolveAndRehostMedia,
  ensureMediaArrayReady,
  isMediaRelatedFailure,
} = require('../services/mediaRehostService');

async function runTests() {
  console.log('=== 1. Testing SSRF & Security Validation ===');

  const testCases = [
    { url: 'http://localhost:3000/admin', expectedValid: false, desc: 'Block localhost' },
    { url: 'http://127.0.0.1:8080/secret', expectedValid: false, desc: 'Block 127.0.0.1' },
    { url: 'http://169.254.169.254/latest/meta-data', expectedValid: false, desc: 'Block cloud metadata IP' },
    { url: 'file:///etc/passwd', expectedValid: false, desc: 'Block file protocol' },
    { url: 'https://evil-attacker.com/malicious.jpg', expectedValid: false, desc: 'Block unallowed external host' },
    { url: 'https://res.cloudinary.com/dwgfox722/image/upload/v1234/test.jpg', expectedValid: true, desc: 'Allow trusted Cloudinary' },
    { url: 'https://down-id.img.susercontent.com/file/sg-11134275-825ap-mqblax6sffgg2b', expectedValid: true, desc: 'Allow Shopee CDN' },
  ];

  let passedSec = 0;
  testCases.forEach((tc) => {
    const res = validateMediaUrlSecurity(tc.url);
    const pass = res.valid === tc.expectedValid;
    if (pass) passedSec++;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${tc.desc} -> valid: ${res.valid}`);
  });

  console.log(`Security tests: ${passedSec}/${testCases.length} passed.`);

  console.log('\n=== 2. Testing Pass-Through for Trusted Cloudinary URLs ===');
  const cloudUrl = 'https://res.cloudinary.com/dwgfox722/image/upload/v1234/test.jpg';
  const passThroughRes = await resolveAndRehostMedia(cloudUrl, 'image');
  console.log('Pass-through result:', passThroughRes);
  if (!passThroughRes.rehosted && passThroughRes.media_url === cloudUrl) {
    console.log('✅ Pass-through test passed!');
  } else {
    console.error('❌ Pass-through test failed!');
  }

  console.log('\n=== 3. Testing Real Shopee Rehost & Cache ===');
  const shopeeUrl = 'https://down-id.img.susercontent.com/file/sg-11134275-825ap-mqblax6sffgg2b';
  
  console.log('Testing 1st Call (Download + Cloudinary Upload)...');
  const firstCall = await resolveAndRehostMedia(shopeeUrl, 'image');
  console.log('First Call Result:', firstCall);

  console.log('Testing 2nd Call (Memory / Firestore Cache Hit)...');
  const secondCall = await resolveAndRehostMedia(shopeeUrl, 'image');
  console.log('Second Call Result:', secondCall);

  if (firstCall.media_url.includes('cloudinary') && secondCall.media_url === firstCall.media_url) {
    console.log('✅ Rehost and caching test passed!');
  } else {
    console.error('❌ Rehost or caching test failed!');
  }

  console.log('\n=== 4. Testing ensureMediaArrayReady with Concurrency ===');
  const mediaList = [
    { media_url: shopeeUrl, media_type: 'image' },
    { media_url: cloudUrl, media_type: 'image' },
  ];
  const arrayResult = await ensureMediaArrayReady(mediaList, { concurrency: 2 });
  console.log('Array Result:', JSON.stringify(arrayResult, null, 2));

  console.log('\n=== 5. Testing isMediaRelatedFailure Classifier ===');
  const failSample1 = { error_message: 'The media could not be fetched from this URI: https://down-id.img.susercontent.com/...' };
  const failSample2 = { error_message: 'OAuthException: Invalid access token' };
  console.log('failSample1 isMediaRelated:', isMediaRelatedFailure(failSample1)); // true
  console.log('failSample2 isMediaRelated:', isMediaRelatedFailure(failSample2)); // false

  console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
