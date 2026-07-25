import https from 'https';

https.get('https://api.xrpl.to/api/tokens?limit=200', {
  headers: { 'User-Agent': 'Mozilla/5.0' }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const j = JSON.parse(d);
      const tokens = j.tokens || [];
      console.log('Total returned:', tokens.length);
      const fuzzy = tokens.find((t) => 
        (t.name || '').toLowerCase().includes('fuzzy') || 
        (t.currency || '').toLowerCase().includes('fuzzy') ||
        (t.symbol || '').toLowerCase().includes('fuzzy')
      );
      console.log('Fuzzy token found?', !!fuzzy);
      if (fuzzy) console.dir(fuzzy, {depth: 1});
      console.log('Sample tokens:', tokens.slice(0,5).map(t => ({name: t.name, currency: t.currency})));
    } catch(e) {
      console.log('parse err', e.message);
    }
  });
}).on('error', e => console.log(e.message));
