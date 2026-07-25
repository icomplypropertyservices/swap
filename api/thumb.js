/**
 * GET /api/thumb?md5=...  or  /api/thumb/{md5}
 * Proxies api.xrpl.to token thumbs with cache to avoid browser 429 stampede.
 */
const UPSTREAM = 'https://api.xrpl.to/v1/thumb'
const MD5_RE = /^[a-f0-9]{32}$/i

/** In-memory cache (warm instance only) */
const cache = new Map()
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const MAX_CACHE = 400

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function extractMd5(req) {
  const q = req.query?.md5 ? String(req.query.md5) : ''
  if (MD5_RE.test(q)) return q.toLowerCase()
  // path style: /api/thumb/abc... or vercel rewrite
  const url = String(req.url || '')
  const m = url.match(/\/api\/thumb\/([a-f0-9]{32})/i) || url.match(/md5=([a-f0-9]{32})/i)
  if (m?.[1]) return m[1].toLowerCase()
  return ''
}

export default async function handler(req, res) {
  cors(res)
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET only' })
    return
  }

  const md5 = extractMd5(req)
  if (!md5) {
    res.status(400).json({ error: 'md5 required (32 hex)' })
    return
  }

  const now = Date.now()
  const hit = cache.get(md5)
  if (hit && now - hit.at < CACHE_TTL_MS) {
    res.setHeader('Content-Type', hit.type)
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    res.setHeader('X-Thumb-Cache', 'HIT')
    res.status(200).send(Buffer.from(hit.buf))
    return
  }

  try {
    const upstream = await fetch(`${UPSTREAM}/${md5}`, {
      headers: {
        Accept: 'image/webp,image/png,image/*;q=0.8',
        'User-Agent': 'RiddleSwap/1.0 (token-thumb-proxy)',
      },
    })
    if (!upstream.ok) {
      res.setHeader('Cache-Control', 'public, max-age=60')
      res.status(upstream.status).json({ error: `upstream ${upstream.status}` })
      return
    }
    const type = upstream.headers.get('content-type') || 'image/webp'
    const ab = await upstream.arrayBuffer()
    const buf = Buffer.from(ab)

    if (cache.size >= MAX_CACHE) {
      const first = cache.keys().next().value
      if (first) cache.delete(first)
    }
    cache.set(md5, { at: now, type, buf })

    res.setHeader('Content-Type', type)
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    res.setHeader('X-Thumb-Cache', 'MISS')
    res.status(200).send(buf)
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : 'thumb proxy failed' })
  }
}
