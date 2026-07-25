import https from 'https';

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
        const candidates = ['tokens', 'tokenList', 'popularTokens', 'topTokens', 'initialData', 'data', 'initialTokens'];
        candidates.forEach(k => {
          if (props[k]) {
            const val = props[k];
            console.log(`\nFound ${k}:`, Array.isArray(val) ? `${val.length} items` : typeof val);
            if (Array.isArray(val) && val[0]) {
              console.log('First item keys:', Object.keys(val[0]).join(', '));
              console.log('Sample:', JSON.stringify(val[0]).slice(0, 600));
            }
          }
        });

        // Check deeper
        if (props.dehydratedState) {
          console.log('\nHas dehydratedState (React Query / tRPC data)');
        }
      } catch (e) {
        console.log('Failed to parse __NEXT_DATA__');
      }
    }

    // Try to find any large array of token-like objects
    const tokenLike = data.match(/\[\s*\{[^}]*"symbol"[^}]*"issuer"[^}]*\}/);
    if (tokenLike) {
      console.log('\nFound inline token-like objects');
    }
  });
}).on('error', e => console.error('ERR:', e.message));
