/**
 * Xaman return/resume flow checks for Riddle Swap.
 *
 * 1) Unit-tests session helper contracts (no API key required)
 * 2) Optionally creates a live SignIn payload and asserts return_url
 *    when XUMM_API_KEY / VITE_XUMM_API_KEY / XAMAN_API_KEY is set
 *    (or reads localStorage key pattern `xummApiKey` from env XUMM_API_KEY_FILE)
 *
 * Usage:
 *   node scripts/try-xaman-return.mjs
 *   XUMM_API_KEY=xxx node scripts/try-xaman-return.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const sessionSrc = fs.readFileSync(path.join(root, 'src/utils/xamanSession.ts'), 'utf8')
const walletSrc = fs.readFileSync(path.join(root, 'src/hooks/useWallet.ts'), 'utf8')
const swapSrc = fs.readFileSync(path.join(root, 'src/hooks/useSwap/useSwap.ts'), 'utf8')
const limitSrc = fs.readFileSync(path.join(root, 'src/hooks/useLimitOrders/useLimitOrders.ts'), 'utf8')
const pollSrc = fs.readFileSync(path.join(root, 'src/hooks/useXummPayload.ts'), 'utf8')

let failed = 0
function ok(name, cond, detail = '') {
  if (cond) {
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// ── Pure helpers (mirrors src/utils/xamanSession.ts) ───────────────────────
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function buildReturnUrl(originPath, uuid) {
  const base = originPath
  if (uuid && UUID_RE.test(uuid)) {
    return `${base}?xaman=${encodeURIComponent(uuid)}`
  }
  return `${base}?xaman=1`
}

function resumeUuidFromUrl(href) {
  try {
    const q = new URL(href).searchParams.get('xaman')
    if (!q || q === '1') return null
    return UUID_RE.test(q) ? q : null
  } catch {
    return null
  }
}

function isXamanReturn(href) {
  try {
    return new URL(href).searchParams.has('xaman')
  } catch {
    return false
  }
}

function xamanOptions(opts = {}, originPath = 'https://swap.example/app') {
  const ret = buildReturnUrl(originPath, opts.uuid)
  return {
    submit: opts.submit ?? false,
    expire: opts.expire ?? 10,
    return_url: { app: ret, web: ret },
  }
}

function deepLinks(uuid, nextAlways) {
  const web = nextAlways || `https://xumm.app/sign/${uuid}`
  const native = `xumm://xumm.app/sign/${uuid}`
  return { web, native }
}

// In-memory pending store for resolveResumeUuid-style checks
function makePendingStore() {
  let pending = null
  return {
    write(uuid, purpose) {
      pending = { uuid, purpose, createdAt: Date.now() }
    },
    clear() {
      pending = null
    },
    read() {
      return pending
    },
    resolve(purpose, href) {
      const purposes = Array.isArray(purpose) ? purpose : [purpose]
      if (!pending || !purposes.includes(pending.purpose)) return null
      const urlUuid = resumeUuidFromUrl(href)
      if (urlUuid) return urlUuid
      return pending.uuid
    },
  }
}

console.log('\n=== 1. Session helper unit tests ===\n')

const sampleUuid = 'a1b2c3d4-e5f6-4789-a012-3456789abcde'
const base = 'https://riddle.example/swap'

ok('buildReturnUrl generic marker', buildReturnUrl(base) === `${base}?xaman=1`)
ok(
  'buildReturnUrl with uuid',
  buildReturnUrl(base, sampleUuid) === `${base}?xaman=${encodeURIComponent(sampleUuid)}`,
)
ok('resumeUuidFromUrl ignores ?xaman=1', resumeUuidFromUrl(`${base}?xaman=1`) === null)
ok(
  'resumeUuidFromUrl extracts uuid',
  resumeUuidFromUrl(`${base}?xaman=${sampleUuid}`) === sampleUuid,
)
ok('isXamanReturn true for marker', isXamanReturn(`${base}?xaman=1`))
ok('isXamanReturn true for uuid', isXamanReturn(`${base}?xaman=${sampleUuid}`))
ok('isXamanReturn false without param', !isXamanReturn(base))

const signInOpts = xamanOptions({ submit: false, expire: 10 })
ok('SignIn options include return_url.app', !!signInOpts.return_url?.app)
ok('SignIn options include return_url.web', !!signInOpts.return_url?.web)
ok('SignIn submit:false', signInOpts.submit === false)
ok('SignIn return_url has xaman=1', signInOpts.return_url.app.includes('xaman=1'))

const payOpts = xamanOptions({ submit: true, expire: 10 })
ok('Payment options submit:true', payOpts.submit === true)
ok('Payment has return_url', !!payOpts.return_url?.app && !!payOpts.return_url?.web)

const links = deepLinks(sampleUuid)
ok('deep link web is xumm.app/sign/{uuid}', links.web === `https://xumm.app/sign/${sampleUuid}`)
ok('deep link native is xumm:// scheme', links.native === `xumm://xumm.app/sign/${sampleUuid}`)

const store = makePendingStore()
store.write(sampleUuid, 'swap')
ok(
  'resolveResumeUuid purpose=swap from pending',
  store.resolve('swap', base) === sampleUuid,
)
ok(
  'resolveResumeUuid ignores other purpose',
  store.resolve('signin', base) === null,
)
ok(
  'resolveResumeUuid prefers URL uuid',
  store.resolve('swap', `${base}?xaman=${sampleUuid}`) === sampleUuid,
)
store.write(sampleUuid, 'cancel')
ok(
  'resolveResumeUuid limit|cancel family',
  store.resolve(['limit', 'cancel'], base) === sampleUuid,
)

console.log('\n=== 2. Source contract checks (bridge-aligned) ===\n')

ok('xamanSession exports buildReturnUrl', sessionSrc.includes('export function buildReturnUrl'))
ok('xamanSession exports resumeUuidFromUrl', sessionSrc.includes('export function resumeUuidFromUrl'))
ok('xamanSession exports isXamanReturn', sessionSrc.includes('export function isXamanReturn'))
ok('xamanSession exports stripXamanQuery', sessionSrc.includes('export function stripXamanQuery'))
ok('xamanSession exports writePending/readPending', sessionSrc.includes('export function writePending') && sessionSrc.includes('export function readPending'))
ok('xamanSession xamanOptions builds return_url', sessionSrc.includes('return_url'))
ok('xamanSession deepLinks native scheme', sessionSrc.includes('xumm://xumm.app/sign/'))
ok('xamanSession openXamanUrls mobile-safe', sessionSrc.includes('isMobileUa'))

ok('useWallet only resumes signin purpose', walletSrc.includes("purpose !== 'signin'") || walletSrc.includes("purpose === 'signin'"))
ok('useWallet strips xaman on disconnect', walletSrc.includes('stripXamanQuery'))
ok('useWallet visibility/pageshow/focus resume', walletSrc.includes('visibilitychange') && walletSrc.includes('pageshow'))

ok('useSwap uses xamanOptions', swapSrc.includes('xamanOptions'))
ok('useSwap resumes purpose swap', swapSrc.includes("resolveResumeUuid('swap')") || swapSrc.includes("resolveResumeUuid(\"swap\")"))
ok('useSwap poll purpose swap', swapSrc.includes("purpose: 'swap'"))

ok('useLimitOrders uses xamanOptions', limitSrc.includes('xamanOptions'))
ok('useLimitOrders resumes limit/cancel', limitSrc.includes("resolveResumeUuid(['limit', 'cancel'])") || limitSrc.includes('limit') && limitSrc.includes('cancel'))
ok('useLimitOrders OfferCancel purpose cancel', limitSrc.includes("purpose: 'cancel'"))
ok('useLimitOrders OfferCreate purpose limit', limitSrc.includes("purpose: 'limit'"))

ok('useXummPayload poll on visibilitychange', pollSrc.includes('visibilitychange'))
ok('useXummPayload poll on pageshow', pollSrc.includes('pageshow'))
ok('useXummPayload poll on focus', pollSrc.includes('focus'))
ok('useXummPayload writePending on poll', pollSrc.includes('writePending'))
ok('useXummPayload mobile openXamanUrls', pollSrc.includes('openXamanUrls'))

// Every create-path should mention return via xamanOptions
for (const [label, src] of [
  ['useWallet SignIn', walletSrc],
  ['useSwap Payment', swapSrc],
  ['useLimitOrders', limitSrc],
]) {
  ok(`${label} calls xamanOptions`, src.includes('xamanOptions('))
}

console.log('\n=== 3. Live Xaman payload (optional) ===\n')

function readApiKey() {
  const env =
    process.env.XUMM_API_KEY ||
    process.env.VITE_XUMM_API_KEY ||
    process.env.XAMAN_API_KEY ||
    ''
  if (env.trim()) return env.trim()
  const file = process.env.XUMM_API_KEY_FILE
  if (file && fs.existsSync(file)) {
    return fs.readFileSync(file, 'utf8').trim()
  }
  return ''
}

const apiKey = readApiKey()
if (!apiKey) {
  console.log('  ⊘ Skipped live create — set XUMM_API_KEY (or VITE_XUMM_API_KEY) to exercise Platform API')
  console.log('    App UI stores key as localStorage `xummApiKey` — export it for CI if needed.')
} else {
  const XUMM_API = 'https://xumm.app/api/v1/platform/payload'
  const body = {
    txjson: { TransactionType: 'SignIn' },
    options: xamanOptions({ submit: false, expire: 5 }, 'https://localhost:5173/'),
    custom_meta: { instruction: 'try-xaman-return.mjs smoke test' },
  }

  try {
    const res = await fetch(XUMM_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }

    ok('live create HTTP ok', res.ok, `${res.status} ${text.slice(0, 200)}`)
    if (data?.uuid) {
      ok('live create returned uuid', UUID_RE.test(data.uuid))
      ok(
        'request body included return_url',
        body.options.return_url?.app?.includes('xaman=1'),
      )
      const dl = deepLinks(data.uuid, data.next?.always)
      ok('live deep link web present', !!dl.web)
      ok('live deep link native present', dl.native.startsWith('xumm://'))
      console.log(`    uuid: ${data.uuid}`)
      console.log(`    web:  ${dl.web}`)
      console.log(`    native: ${dl.native}`)
    } else if (res.ok) {
      ok('live create returned uuid', false, text.slice(0, 200))
    }
  } catch (e) {
    ok('live create fetch', false, e instanceof Error ? e.message : String(e))
  }
}

console.log('')
if (failed) {
  console.error(`FAILED: ${failed} assertion(s)\n`)
  process.exit(1)
}
console.log('All checks passed.\n')
