const https = require('https');

const options = {
  hostname: 'lynk.id',
  path: '/aronisme/vglvo503pe54',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  }
};

const req = https.request(options, (res) => {
  console.log('Status Code:', res.statusCode);
  if (res.headers.location) {
    console.log('Location:', res.headers.location);
  }
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Body length:', data.length);
    const startTag = '<script id="__NEXT_DATA__" type="application/json">';
    const endTag = '</script>';
    const startIdx = data.indexOf(startTag);
    if (startIdx !== -1) {
      const endIdx = data.indexOf(endTag, startIdx);
      const jsonStr = data.substring(startIdx + startTag.length, endIdx);
      try {
        const json = JSON.parse(jsonStr);
        console.log('=== SUCCESS PARSING __NEXT_DATA__ ===');
        console.log(JSON.stringify(json, null, 2).slice(0, 3000));
        require('fs').writeFileSync('lynk_data.json', JSON.stringify(json, null, 2));
        console.log('Saved to lynk_data.json');
      } catch (e) {
        console.log('JSON Parse error:', e.message);
      }
    } else {
      console.log('No __NEXT_DATA__ found. Preview html:', data.slice(0, 1500));
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.end();
