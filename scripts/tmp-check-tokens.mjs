import https from 'https';

const urls = [
  'https://api.xrpl.to/api/tokens?limit=500',
  'https://api.xrpl.to/api/tokens',
];

for (const u of urls) {
  await new Promise(r => {
    https.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          const ts = j.tokens || j.data || [];
          console.log(u, '->', ts.length);
          const fz = ts.find(t => String(t.name || t.currency || '').toLowerCase().match(/fuzz/));
          if (fz) console.log('  FUZZY:', fz);
          if (ts.length) console.log('  sample:', ts.slice(0,3).map(t => t.name || t.currency));
        } catch(e){ console.log(u, 'err', e.message); }
        r();
      });
    }).on('error', e => { console.log(u, 'neterr', e.message); r(); });
  });
}
console.log('done');
