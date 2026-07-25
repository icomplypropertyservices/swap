import https from 'https';

https.get('https://xrpl.to', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const m = d.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return console.log('no __NEXT_DATA__');
    const json = JSON.parse(m[1]);
    const p = json.props?.pageProps || {};

    console.log('Top level pageProps keys:', Object.keys(p));

    if (p.summaryTokens) {
      console.log('\n=== summaryTokens ===');
      console.log('type:', typeof p.summaryTokens);
      if (Array.isArray(p.summaryTokens)) {
        console.log('count:', p.summaryTokens.length);
        console.dir(p.summaryTokens.slice(0, 2), { depth: 2 });
      } else {
        console.dir(p.summaryTokens, { depth: 1 });
      }
    }

    if (p.data) {
      console.log('\n=== data keys ===');
      console.log(Object.keys(p.data));
      // try to find token arrays inside data
      const scan = (o, path = '') => {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o) && o.length > 0 && o[0] && (o[0].symbol || o[0].currency || o[0].name)) {
          console.log(`\nFound array of tokens at ${path}, length=${o.length}`);
          console.dir(o.slice(0, 1), { depth: 1 });
        }
        for (const [k, v] of Object.entries(o)) scan(v, path ? `${path}.${k}` : k);
      };
      scan(p.data, 'data');
    }
  });
}).on('error', console.error);
