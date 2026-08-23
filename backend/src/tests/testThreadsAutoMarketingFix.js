const { runOutboundSocialListening } = require('../services/threads/outbound/outboundService');
const { scanAndProcessInboundReplies } = require('../services/threads/inbound/inboundService');
const { classifyCommentIntent } = require('../services/threads/inbound/intentClassifier');
const { processScheduledPosts } = require('../workers/scheduler');
const { db } = require('../config/firebase');

async function testAll() {
  const uid = 'uJhx9rqu8QXrhBELW56nclJNRyk2';
  
  console.log('=== TEST 1: Intent Classifier Indonesian Slang ===');
  const testComments = [
    'spill min belinya dmn?',
    'link dong kak',
    'mau ini belinya lewat mana ya?',
    'bagus bgt bajunya',
    'penipu lu',
    'bahan adem ga kak?'
  ];
  for (const c of testComments) {
    const res = await classifyCommentIntent(c);
    console.log(`[Intent] "${c}" -> ${res.intent} (${res.confidence})`);
  }

  console.log('\n=== TEST 2: Outbound Social Listening ===');
  const outRes = await runOutboundSocialListening(uid);
  console.log('Outbound Result:', outRes);

  console.log('\n=== TEST 3: Inbound Replies Scan ===');
  const inRes = await scanAndProcessInboundReplies(uid);
  console.log('Inbound Result:', inRes);

  console.log('\n=== TEST 4: Check Candidates in DB ===');
  const candSnap = await db.collection('threads_candidates').where('user_id', '==', uid).get();
  console.log('Total candidates found in DB:', candSnap.size);
  candSnap.forEach(d => {
    const c = d.data();
    console.log(`- Candidate #${d.id}: @${c.author_username} | Product: ${c.matched_product_title?.slice(0, 30)} | Intent: ${c.buying_intent_score} | Relevance: ${c.relevance_score}`);
  });

  console.log('\n=== TEST 5: Check Keywords last_searched_at ===');
  const kwSnap = await db.collection('threads_monitoring_keywords').where('user_id', '==', uid).limit(5).get();
  kwSnap.forEach(d => {
    console.log(`- Keyword "${d.data().keyword}": last_searched_at = ${d.data().last_searched_at}`);
  });
}

testAll().then(() => process.exit(0)).catch(e => { console.error('Error during test:', e); process.exit(1); });
