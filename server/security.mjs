/**
 * Edge security for Riddle Swap Xaman Platform proxy.
 * Allowlist: SignIn, Payment (XRP + issued), OfferCreate, OfferCancel.
 */
const XUMM_API = 'https://xumm.app/api/v1/platform/payload'

/** @type {Map<string, { count: number, resetAt: number }>} */
const buckets = new Map()

export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now()
  let b = buckets.get(key)
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs }
    buckets.set(key, b)
  }
  b.count += 1
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (now >= v.resetAt) buckets.delete(k)
    }
  }
  if (b.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) }
  }
  return { ok: true }
}

export function clientIpFromHeaders(headers) {
  const h = headers || {}
  const xf = String(h['x-forwarded-for'] || h['X-Forwarded-For'] || '')
    .split(',')[0]
    .trim()
  if (xf) return xf.slice(0, 64)
  const real = String(h['x-real-ip'] || h['X-Real-Ip'] || '').trim()
  if (real) return real.slice(0, 64)
  return 'unknown'
}

export function fromHttpReq(req, extras = {}) {
  const headers = req.headers || {}
  let body
  if (extras.body !== undefined) body = extras.body
  else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {})
  }
  return {
    method: req.method || 'GET',
    clientIp: clientIpFromHeaders(headers),
    headers,
    body,
    uuid: extras.uuid ?? (req.query?.uuid ? String(req.query.uuid) : undefined),
    ...extras,
  }
}

export function jsonError(status, error, headers) {
  const out = {
    status,
    body: JSON.stringify(typeof error === 'string' ? { error } : error),
    contentType: 'application/json',
  }
  if (headers) out.headers = headers
  return out
}

export function enforceRate(key, opts) {
  const rl = rateLimit(key, opts)
  if (rl.ok) return null
  return jsonError(
    429,
    { error: 'Too many requests', retryAfter: rl.retryAfterSec },
    { 'Retry-After': String(rl.retryAfterSec) },
  )
}

const XRPL_ADDR = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DROPS = /^[0-9]{1,20}$/
const CUR_HEX = /^[A-Fa-f0-9]{40}$/
const CUR_ISO = /^[A-Za-z0-9]{3}$/

const ALLOWED_TYPES = new Set(['SignIn', 'Payment', 'OfferCreate', 'OfferCancel'])

function isCurrency(c) {
  const s = String(c || '')
  return s === 'XRP' || CUR_ISO.test(s) || CUR_HEX.test(s)
}

function isAmount(amt, { allowIssued }) {
  if (typeof amt === 'string') return DROPS.test(amt) && amt !== '0'
  if (amt && typeof amt === 'object' && allowIssued) {
    const cur = String(amt.currency || '')
    const iss = String(amt.issuer || '')
    const val = String(amt.value || '')
    return isCurrency(cur) && XRPL_ADDR.test(iss) && !!val && Number(val) > 0
  }
  return false
}

function validatePayment(txjson) {
  const dest = String(txjson.Destination || '')
  if (!XRPL_ADDR.test(dest)) return 'Payment Destination must be a classic XRPL address'
  if (!isAmount(txjson.Amount, { allowIssued: true })) return 'Payment Amount invalid'
  if (txjson.SendMax != null && !isAmount(txjson.SendMax, { allowIssued: true })) {
    return 'Payment SendMax invalid'
  }
  return null
}

function validateOfferCreate(txjson) {
  if (!isAmount(txjson.TakerPays, { allowIssued: true })) return 'OfferCreate TakerPays invalid'
  if (!isAmount(txjson.TakerGets, { allowIssued: true })) return 'OfferCreate TakerGets invalid'
  return null
}

function validateOfferCancel(txjson) {
  const seq = Number(txjson.OfferSequence)
  if (!Number.isFinite(seq) || seq < 0) return 'OfferCancel OfferSequence invalid'
  return null
}

const TX_VALIDATORS = {
  SignIn: () => null,
  Payment: (tx) => validatePayment(tx),
  OfferCreate: (tx) => validateOfferCreate(tx),
  OfferCancel: (tx) => validateOfferCancel(tx),
}

function sanitizeOptions(opts) {
  const out = {}
  if (typeof opts.submit === 'boolean') out.submit = opts.submit
  if (typeof opts.expire === 'number' && opts.expire > 0 && opts.expire <= 60) {
    out.expire = Math.floor(opts.expire)
  }
  if (opts.return_url && typeof opts.return_url === 'object') {
    const app = String(opts.return_url.app || '').slice(0, 512)
    const web = String(opts.return_url.web || '').slice(0, 512)
    const okUrl = (u) =>
      !u ||
      /^https:\/\/([a-z0-9-]+\.)*riddlewallet\.com(\/|$)/i.test(u) ||
      /^https:\/\/([a-z0-9-]+\.)*vercel\.app(\/|$)/i.test(u) ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(u)
    if (okUrl(app) && okUrl(web)) {
      out.return_url = {}
      if (app) out.return_url.app = app
      if (web) out.return_url.web = web
    }
  }
  return out
}

export function validateXamanCreateBody(bodyRaw) {
  let parsed
  try {
    parsed = JSON.parse(bodyRaw || '{}')
  } catch {
    return { ok: false, status: 400, error: 'Invalid JSON body' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, status: 400, error: 'Body must be a JSON object' }
  }
  const txjson = parsed.txjson
  if (!txjson || typeof txjson !== 'object' || Array.isArray(txjson)) {
    return { ok: false, status: 400, error: 'txjson required' }
  }
  const tt = String(txjson.TransactionType || '')
  if (!ALLOWED_TYPES.has(tt)) {
    return { ok: false, status: 403, error: `TransactionType not allowed: ${tt || '(missing)'}` }
  }
  if (txjson.Account != null) {
    return { ok: false, status: 400, error: 'Account must not be set (wallet fills it)' }
  }
  const err = TX_VALIDATORS[tt]?.(txjson)
  if (err) return { ok: false, status: 400, error: err }

  const safe = {
    txjson,
    options:
      parsed.options && typeof parsed.options === 'object' && !Array.isArray(parsed.options)
        ? sanitizeOptions(parsed.options)
        : { submit: tt !== 'SignIn', expire: tt === 'SignIn' ? 10 : 15 },
  }
  if (parsed.custom_meta && typeof parsed.custom_meta === 'object') {
    safe.custom_meta = { instruction: String(parsed.custom_meta.instruction || '').slice(0, 280) }
  }
  return { ok: true, body: JSON.stringify(safe) }
}

export function isValidPayloadUuid(uuid) {
  return UUID_RE.test(String(uuid || '').trim())
}

export function createXamanProxy(cfg = {}) {
  const postLimit = cfg.postLimit ?? 30
  const getLimit = cfg.getLimit ?? 180
  const notConfigured = 'Xaman not configured on server'

  return async function proxyXaman(req, env) {
    const xummKey = String(env.XUMM_API_KEY || '').trim()
    const xummSecret = String(env.XUMM_API_SECRET || '').trim()
    if (!xummKey || !xummSecret) return jsonError(503, notConfigured)

    const ip = req.clientIp || clientIpFromHeaders(req.headers) || 'unknown'
    const method = (req.method || 'GET').toUpperCase()
    const headers = {
      Accept: 'application/json',
      'X-API-Key': xummKey,
      'X-API-Secret': xummSecret,
    }

    try {
      if (method === 'POST') {
        const rl = rateLimit(`xaman:post:${ip}`, { limit: postLimit, windowMs: 60_000 })
        if (!rl.ok) {
          return jsonError(
            429,
            { error: 'Too many Xaman creates', retryAfter: rl.retryAfterSec },
            { 'Retry-After': String(rl.retryAfterSec) },
          )
        }
        const validated = validateXamanCreateBody(req.body || '{}')
        if (!validated.ok) return jsonError(validated.status, validated.error)
        headers['Content-Type'] = 'application/json'
        const upstream = await fetch(XUMM_API, {
          method: 'POST',
          headers,
          body: validated.body,
        })
        return {
          status: upstream.status,
          body: await upstream.text(),
          contentType: 'application/json',
        }
      }

      if (method === 'GET') {
        const limited = enforceRate(`xaman:get:${ip}`, { limit: getLimit, windowMs: 60_000 })
        if (limited) return limited
        if (!req.uuid || !isValidPayloadUuid(req.uuid)) {
          return jsonError(400, 'valid uuid required')
        }
        const upstream = await fetch(`${XUMM_API}/${encodeURIComponent(req.uuid)}`, { headers })
        return {
          status: upstream.status,
          body: await upstream.text(),
          contentType: 'application/json',
        }
      }

      return jsonError(405, 'Method not allowed')
    } catch (e) {
      return jsonError(502, e instanceof Error ? e.message : 'Xaman proxy error')
    }
  }
}

export { XUMM_API }
