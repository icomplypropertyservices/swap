const https = require('https');

https.get('https://xrpl.to', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    
    // Find possible API endpoints
    const apis = new Set();
    const urlRegex = /["'](https?:\/\/[^"'\s]*(?:api|tokens|tokenlist|popular|top)[^"'\s]*)["']/gi;
    let m;
    while ((m = urlRegex.exec(data)) !== null) {
      if (m[1].includes('xrpl.to')) apis.add(m[1]);
    }
    console.log('\n=== xrpl.to related API-like URLs ===');
    [...apis].slice(0, 20).forEach(u => console.log(u));

    // Look for __NEXT_DATA__
    const nextMatch = data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextMatch) {
      try {
        const json = JSON.parse(nextMatch[1]);
        const props = json.props?.pageProps || {};
        console.log('\n=== Keys in pageProps ===');
        console.log(Object.keys(props).join(', '));

        // Check for token data
        const candidates = ['tokens', 'tokenList', 'popularTokens', 'topTokens', 'initialData', 'data'];
        candidates.forEach(k => {
          if (props[k]) {
            console.log(`\nFound ${k}:`, Array.isArray(props[k]) ? `${props[k].length} items` : typeof props[k]);
            if (Array.isArray(props[k]) && props[k][0]) {
              console.log('Sample:', JSON.stringify(props[k][0], null, 2).slice(0, 800));
            }
          }
        });
      } catch (e) {
        console.log('Failed to parse __NEXT_DATA__');
      }
    }

    // Look for any inline token arrays
    const tokenArrayMatch = data.match(/(\[\s*\{[^}]*"symbol"[^}]*"currency"[^}]*\}\s*(?:,\s*\{[^}]*"symbol"[^}]*"currency"[^}]*\s*)*\])/);
    if (tokenArrayMatch) {
      console.log('\nFound possible inline token array');
    }
  });
}).on('error', e => console.error('ERR:', e.message));
