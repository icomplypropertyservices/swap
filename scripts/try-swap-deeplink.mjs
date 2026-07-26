/**
 * Unit checks for swap trade-form deeplink helpers.
 * Mirrors contracts in src/utils/swapDeeplink.ts + buildReturnUrl preserve.
 *
 *   node scripts/try-swap-deeplink.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const deeplinkSrc = fs.readFileSync(path.join(root, 'src/utils/swapDeeplink.ts'), 'utf8')
const sessionSrc = fs.readFileSync(path.join(root, 'src/utils/xamanSession.ts'), 'utf8')
const appSrc = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8')

let failed = 0
function ok(name, cond, detail = '') {
  if (cond) console.log(`  ✓ ${name}`)
  else {
    failed += 1
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// ── Pure mirrors of swapDeeplink helpers ───────────────────────────────────
const XRPL_CHAIN_ALIASES = new Set(['', 'xrpl', 'xrp', 'ripple', 'xrp-ledger', 'xrp_ledger', 'xrpledger'])
const FOREIGN_CHAIN_ALIASES = new Set([
  'eth', 'ethereum', 'evm', 'bsc', 'bnb', 'bnbbsc', 'polygon', 'matic', 'arb', 'arbitrum',
  'op', 'optimism', 'base', 'avax', 'avaxc', 'sol', 'solana', 'xlm', 'stellar', 'btc', 'bitcoin',
])

function isXrplChainParam(chain) {
  if (chain == null || chain === '') return true
  const c = String(chain).toLowerCase().trim()
  if (XRPL_CHAIN_ALIASES.has(c)) return true
  if (FOREIGN_CHAIN_ALIASES.has(c)) return false
  return !/^(eth|sol|bnb|matic|arb|op|base|avax|xlm|btc)/i.test(c)
}

function normalizePayAmount(raw) {
  if (raw == null) return undefined
  const s = String(raw).trim().replace(/,/g, '')
  if (!s) return undefined
  if (!/^\d*\.?\d+$/.test(s)) return undefined
  const n = parseFloat(s)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return s
}

function parseSwapDeeplink(href) {
  try {
    const sp = new URL(href).searchParams
    const get = (k) => {
      const v = sp.get(k)
      return v != null && v.trim() !== '' ? v.trim() : undefined
    }
    const amount = get('amount') || get('pay') || get('qty') || get('value')
    return {
      from: get('from') || get('fromToken') || get('sell'),
      to: get('to') || get('toToken') || get('buy'),
      amount,
      chain: get('chain') || get('network') || get('net'),
      source: get('source'),
    }
  } catch {
    return {}
  }
}

function hasSwapDeeplink(href) {
  const p = parseSwapDeeplink(href)
  return !!(p.from || p.to || p.amount || p.chain)
}

/** buildReturnUrl-style preserve (mirror of xamanSession — literal xaman={id}) */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function buildReturnUrl(href, _uuid) {
  const u = new URL(href)
  u.searchParams.delete('xaman')
  const qs = u.searchParams.toString()
  const pathAndQuery = u.pathname + (qs ? `?${qs}` : '')
  const join = pathAndQuery.includes('?') ? '&' : '?'
  return `${u.origin}${pathAndQuery}${join}xaman={id}${u.hash || ''}`
}

function stripXamanQuery(href) {
  const u = new URL(href)
  if (!u.searchParams.has('xaman')) return href
  u.searchParams.delete('xaman')
  const qs = u.searchParams.toString()
  return u.pathname + (qs ? `?${qs}` : '') + u.hash
}

console.log('\n=== 1. parseSwapDeeplink ===\n')

const sample =
  'https://swap.riddlewallet.com/?from=XRP&to=SOLO&amount=25.5&chain=xrpl&source=riddle-wallet'
const p = parseSwapDeeplink(sample)
ok('reads from', p.from === 'XRP')
ok('reads to', p.to === 'SOLO')
ok('reads amount', p.amount === '25.5')
ok('reads chain', p.chain === 'xrpl')
ok('reads source', p.source === 'riddle-wallet')
ok('hasSwapDeeplink true', hasSwapDeeplink(sample))
ok('hasSwapDeeplink false on clean', !hasSwapDeeplink('https://swap.riddlewallet.com/'))
ok(
  'ignores xaman-only (no trade keys)',
  !hasSwapDeeplink('https://swap.riddlewallet.com/?xaman=1'),
)
ok(
  'coexists with xaman',
  parseSwapDeeplink('https://swap.riddlewallet.com/?from=XRP&to=USD&xaman=1').from === 'XRP',
)
ok(
  'amount alias pay=',
  parseSwapDeeplink('https://x.test/?pay=3').amount === '3',
)
ok(
  'issuer form with colon preserved in from',
  parseSwapDeeplink(
    'https://x.test/?from=USD:rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq&to=XRP',
  ).from === 'USD:rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq',
)

console.log('\n=== 2. amount + chain guards ===\n')

ok('normalizePayAmount 10', normalizePayAmount('10') === '10')
ok('normalizePayAmount rejects 0', normalizePayAmount('0') === undefined)
ok('normalizePayAmount rejects negative', normalizePayAmount('-1') === undefined)
ok('normalizePayAmount rejects junk', normalizePayAmount('abc') === undefined)
ok('normalizePayAmount strips commas', normalizePayAmount('1,000.5') === '1000.5')
ok('isXrplChain empty', isXrplChainParam(undefined) === true)
ok('isXrplChain xrpl', isXrplChainParam('xrpl') === true)
ok('isXrplChain xrp', isXrplChainParam('xrp') === true)
ok('isXrplChain eth false', isXrplChainParam('eth') === false)
ok('isXrplChain solana false', isXrplChainParam('solana') === false)

console.log('\n=== 3. Xaman return must preserve trade params ===\n')

const withTrade = 'https://swap.riddlewallet.com/?from=XRP&to=SOLO&amount=10&chain=xrpl'
const ret = buildReturnUrl(withTrade)
ok('return keeps from', ret.includes('from=XRP'))
ok('return keeps to', ret.includes('to=SOLO'))
ok('return keeps amount', ret.includes('amount=10'))
ok('return keeps chain', ret.includes('chain=xrpl'))
ok('return sets xaman={id}', /[?&]xaman=\{id\}(?:&|$|#)/.test(ret))
ok('return does not URL-encode braces', !ret.includes('%7B') && ret.includes('xaman={id}'))

const uuid = 'a1b2c3d4-e5f6-4789-a012-3456789abcde'
const retUuid = buildReturnUrl(withTrade, uuid)
ok('return keeps trade + {id} (uuid ignored at create)', retUuid.includes('from=XRP') && retUuid.includes('xaman={id}'))

const stripped = stripXamanQuery(ret)
ok('stripXaman removes xaman only', !stripped.includes('xaman') && stripped.includes('from=XRP'))

console.log('\n=== 4. Source contracts ===\n')

ok('swapDeeplink.ts exports parseSwapDeeplink', deeplinkSrc.includes('export function parseSwapDeeplink'))
ok('swapDeeplink.ts exports resolveSwapDeeplink', deeplinkSrc.includes('export function resolveSwapDeeplink'))
ok('swapDeeplink.ts exports hasSwapDeeplink', deeplinkSrc.includes('export function hasSwapDeeplink'))
ok('swapDeeplink mentions from/to/amount/chain', /from/.test(deeplinkSrc) && /to/.test(deeplinkSrc) && /amount/.test(deeplinkSrc) && /chain/.test(deeplinkSrc))
ok(
  'buildReturnUrl uses literal xaman={id}',
  sessionSrc.includes('xaman={id}') && !sessionSrc.includes("searchParams.set('xaman'"),
)
ok('App applies resolveSwapDeeplink', appSrc.includes('resolveSwapDeeplink'))
ok('App uses hasSwapDeeplink', appSrc.includes('hasSwapDeeplink'))
ok('App sets pay amount from deeplink', appSrc.includes('setPayAmount'))
ok('App does not strip xaman when applying deeplink', !/stripXamanQuery\(\)/.test(appSrc.split('resolveSwapDeeplink')[1]?.slice(0, 800) || ''))

console.log('')
if (failed) {
  console.error(`FAILED: ${failed} check(s)`)
  process.exit(1)
}
console.log('All swap-deeplink checks passed.')
process.exit(0)
