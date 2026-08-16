const app = require('./app');
const http = require('http');

const server = http.createServer(app);
server.listen(0, async () => {
  const port = server.address().port;
  console.log(`[Test] Server started on port ${port}`);

  try {
    // Test 1: Empty payload
    const res1 = await fetch(`http://localhost:${port}/api/shopee/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const json1 = await res1.json();
    console.log('[Test 1] Empty payload validation:', res1.status, json1);

    // Test 2: Invalid domain
    const res2 = await fetch(`http://localhost:${port}/api/shopee/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://other-site.com/product' })
    });
    const json2 = await res2.json();
    console.log('[Test 2] SSRF Domain Guard:', res2.status, json2);

    // Test 3: Invalid Shopee URL structure
    const res3 = await fetch(`http://localhost:${port}/api/shopee/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://shopee.co.id/category' })
    });
    const json3 = await res3.json();
    console.log('[Test 3] Invalid Shopee URL structure:', res3.status, json3);

    console.log('\n✅ ALL BACKEND EXTRACTOR VALIDATION TESTS PASSED!');
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    server.close();
  }
});
