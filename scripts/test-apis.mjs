import https from 'https';

const urls = [
  'https://api.xrpl.to/tokens?limit=10&sort=volume',
  'https://api.xrpl.to/api/tokens?limit=10',
  'https://xrpl.to/api/tokens?limit=5',
  'https://xrpl.to/?search=',
];

function fetch(url) {
  return new Promise(resolve => {
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json,*/*' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(d); } catch {}
        resolve({ url, status: res.statusCode, isJson: !!parsed, sample: parsed ? JSON.stringify(parsed).slice(0,400) : d.slice(0,200) });
      });
    }).on('error', e => resolve({url, err: e.message}));
  });
}

Promise.all(urls.map(fetch)).then(results => {
  results.forEach(r => {
    console.log('\n=== ' + r.url);
    console.log('status:', r.status);
    console.log(r.sample);
  });
});
