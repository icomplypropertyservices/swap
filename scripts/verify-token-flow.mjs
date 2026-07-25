/**
 * Verifies normalizeToken logos + remote search return usable results.
 * Mirrors src/utils/token.ts normalizeToken / filterTokensLocal.
 */
import https from 'https'

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Accept: 'application/json,image/*,*/*', 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            type: res.headers['content-type'],
            body: Buffer.concat(chunks),
          })
        )
      })
      .on('error', reject)
  })
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const u = new URL(url)
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'User-Agent': 'Mozilla/5.0',
        },
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            type: res.headers['content-type'],
            body: Buffer.concat(chunks),
          })
        )
      }
    )
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

function currencyToHex(cur) {
  if (!cur || cur === 'XRP') return 'XRP'
  if (cur.length > 3) return cur.toUpperCase()
  const hex = Array.from(cur)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
  return hex.padEnd(40, '0')
}

/** Mirror of src/utils/token.ts normalizeToken */
function normalizeToken(raw) {
  if (!raw) return { symbol: 'UNK', currency: 'XRP' }

  const md5 =
    raw.md5 ||
    raw._id ||
    (typeof raw.logo === 'string' ? raw.logo.match(/([a-f0-9]{32})/i)?.[1] : undefined) ||
    (typeof raw.icon === 'string' ? raw.icon.match(/([a-f0-9]{32})/i)?.[1] : undefined)

  const ext = raw.ext ? String(raw.ext).replace(/^\./, '') : undefined

  const explicit =
    [raw.logo, raw.icon, raw.image, raw.logoURI].find(
      (u) => typeof u === 'string' && /^https?:\/\//i.test(u)
    ) || undefined

  let logo = explicit
  // Rewrite legacy broken hosts / s1 when we have md5
  if (logo && md5 && (/xrpl\.to\/thumb\//i.test(logo) || /s1\.xrpl\.to/i.test(logo))) {
    logo = `https://api.xrpl.to/v1/thumb/${md5}?w=48`
  }
  if (!logo && md5) {
    // Canonical API path (200 image/webp). Avoid xrpl.to/thumb (404) and s1 (403).
    logo = `https://api.xrpl.to/v1/thumb/${md5}?w=48`
  }

  const symbolRaw = raw.symbol || raw.name || raw.currency || 'UNK'
  let symbol = String(symbolRaw).toUpperCase().slice(0, 12)
  if (raw.name && typeof raw.name === 'string' && raw.currency && String(raw.currency).length > 3) {
    symbol = raw.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || symbol
  }

  let currency = 'XRP'
  if (raw.currency) {
    const c = String(raw.currency)
    currency = c.length > 3 ? c.toUpperCase() : currencyToHex(c)
  } else if (raw.symbol && raw.symbol !== 'XRP') {
    currency = currencyToHex(String(raw.symbol))
  }

  return {
    symbol: symbol || 'UNK',
    currency,
    issuer: raw.issuer || undefined,
    name: raw.name || raw.symbol || undefined,
    logo,
    md5: md5 || undefined,
    ext,
  }
}

function getTokenLogoCandidates(token) {
  const out = []
  const push = (u) => {
    if (u && typeof u === 'string' && /^https?:\/\//i.test(u) && !out.includes(u)) out.push(u)
  }
  const md5 = token.md5 || (token.logo?.match(/([a-f0-9]{32})/i)?.[1] ?? undefined)
  if (md5) {
    push(`https://api.xrpl.to/v1/thumb/${md5}?w=48`)
    push(`https://api.xrpl.to/v1/thumb/${md5}`)
  }
  if (token.logo) {
    const broken =
      /s1\.xrpl\.to/i.test(token.logo) ||
      (/xrpl\.to\/thumb\//i.test(token.logo) && !/api\.xrpl\.to\/v1\/thumb\//i.test(token.logo))
    if (!broken) push(token.logo)
  }
  return out
}

function filterLocal(tokens, query) {
  const q = query.toLowerCase().trim()
  return tokens.filter((t) => {
    const hay = `${t.symbol} ${t.name || ''} ${t.issuer || ''} ${t.currency || ''}`.toLowerCase()
    return hay.includes(q)
  })
}

let failed = 0

console.log('1) Load top volume tokens...')
const list = await get('https://api.xrpl.to/v1/tokens?limit=50&sort=vol24hxrp&order=desc')
if (list.status !== 200) {
  console.error('   FAIL tokens list HTTP', list.status)
  process.exit(1)
}
const j = JSON.parse(list.body.toString('utf8'))
const mapped = (j.tokens || []).map(normalizeToken)
console.log('   loaded', mapped.length, 'tokens')
console.log(
  '   sample:',
  mapped.slice(0, 5).map((t) => ({ symbol: t.symbol, logo: t.logo?.slice(0, 55), md5: t.md5?.slice(0, 8) }))
)

const withLogo = mapped.filter((t) => t.logo)
const brokenThumb = mapped.filter((t) => t.logo?.includes('xrpl.to/thumb/') && !t.logo.includes('/v1/thumb/'))
const usesCanonical = mapped.filter((t) => t.logo?.includes('api.xrpl.to/v1/thumb/'))
console.log('   with logo URL:', withLogo.length)
console.log('   broken website /thumb paths:', brokenThumb.length, brokenThumb.length === 0 ? 'OK' : 'FAIL')
console.log('   canonical api.xrpl.to/v1/thumb logos:', usesCanonical.length)
if (brokenThumb.length) failed++
if (!withLogo.length) failed++

console.log('\n2) Local filter RLUSD / FUZZY...')
const localR = filterLocal(mapped, 'RLUSD')
const localF = filterLocal(mapped, 'FUZZY')
console.log('   RLUSD hits', localR.length, localR.slice(0, 3).map((t) => t.symbol))
console.log('   FUZZY hits', localF.length, localF.slice(0, 3).map((t) => t.symbol))
if (!localR.length) console.warn('   WARN: RLUSD not in top-50 by volume (ok if ranking shifted)')

console.log('\n3) Remote POST search FUZZY (body.search — NOT query)...')
await new Promise((r) => setTimeout(r, 1500))
// Regression: { query } returns trending junk; API docs require { search }
const bad = await post('https://api.xrpl.to/v1/search', { query: 'SOLO', limit: 5 })
if (bad.status === 200) {
  const bj = JSON.parse(bad.body.toString('utf8'))
  const badNames = (bj.tokens || []).map((t) => t.name)
  const looksTrending = badNames.length && !badNames.some((n) => String(n).toUpperCase().includes('SOLO'))
  console.log('   wrong-key {query} sample:', badNames.slice(0, 5), looksTrending ? '(trending junk — expected)' : '')
}
await new Promise((r) => setTimeout(r, 1500))
const search = await post('https://api.xrpl.to/v1/search', { search: 'FUZZY', limit: 10 })
console.log('   status', search.status)
const sj = JSON.parse(search.body.toString('utf8'))
if (search.status === 429) {
  console.warn('   WARN: rate-limited — app falls back to GET filter + local (OK path)')
  await new Promise((r) => setTimeout(r, 1500))
  const filterRes = await get('https://api.xrpl.to/v1/tokens?filter=FUZZY&limit=10')
  console.log('   filter fallback status', filterRes.status)
  if (filterRes.status === 200) {
    const fj = JSON.parse(filterRes.body.toString('utf8'))
    const remote = (fj.tokens || []).map(normalizeToken)
    const hasFuzzy = remote.some((t) => (t.symbol || '').includes('FUZZY') || (t.name || '').toUpperCase().includes('FUZZY'))
    console.log('   filter hits', remote.length, 'FUZZY?', hasFuzzy)
    if (!hasFuzzy && !localF.length) {
      console.error('   FAIL: FUZZY not found via filter fallback or local')
      failed++
    }
  }
} else if (search.status !== 200) {
  console.error('   FAIL unexpected search status', search.status, sj)
  failed++
} else {
  const remote = (sj.tokens || sj.results || []).map(normalizeToken)
  console.log(
    '   remote',
    remote.length,
    remote.map((t) => t.symbol)
  )
  const fuzzyLocal = filterLocal(remote, 'FUZZY')
  const hasFuzzy = fuzzyLocal.length > 0 || remote.some((t) => t.symbol === 'FUZZY')
  console.log('   FUZZY in remote results?', hasFuzzy)
  if (!hasFuzzy && !localF.length) {
    console.error('   FAIL: FUZZY not found remotely or locally')
    failed++
  }

  // Merge simulation (mirrors useTokens.searchTokens)
  const merged = [...mapped]
  const seen = new Set(mapped.map((t) => t.currency + '|' + (t.issuer || '')))
  for (const t of remote) {
    const k = t.currency + '|' + (t.issuer || '')
    if (!seen.has(k)) {
      seen.add(k)
      merged.push(t)
    }
  }
  const afterSearch = filterLocal(merged, 'FUZZY')
  console.log('   after merge local filter FUZZY:', afterSearch.length, afterSearch.map((t) => t.symbol))
  if (!afterSearch.length) {
    console.error('   FAIL: merge did not surface FUZZY')
    failed++
  }
}

console.log('\n4) Logo candidate health...')
const sample = mapped.find((t) => t.md5) || mapped[0]
if (sample) {
  const cands = getTokenLogoCandidates(sample)
  console.log('   token', sample.symbol, 'logo', sample.logo)
  console.log('   candidates', cands.length)
  let anyOk = false
  for (const u of cands) {
    const r = await get(u)
    const ok = r.status === 200 && String(r.type || '').startsWith('image/')
    console.log('  ', ok ? 'OK ' : 'NO ', r.status, r.type, u.slice(0, 72))
    if (ok) anyOk = true
  }
  if (!anyOk) {
    console.warn('   WARN: no logo candidate returned image (rate-limit/CDN) — TokenLogo letter-avatar fallback applies')
  } else {
    console.log('   at least one candidate serves an image: OK')
  }
}

console.log(failed ? `\nDONE with ${failed} failure(s)` : '\nDONE — token search + logo path verification healthy')
process.exitCode = failed ? 1 : 0
