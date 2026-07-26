/**
 * Swap trade-form deep-link: ?from=&to=&amount=&chain=
 *
 * Used by suite openers (e.g. riddle-wallet openSwapSuite) to prefill the DEX form.
 * Must coexist with Xaman return markers (?xaman={id} / ?xaman=<uuid> / legacy ?xaman=1) — never strip those.
 */

import type { Token } from '../types'
import { currencyToHex, isXRP, NATIVE_XRP } from './xrpl'
import { normalizeToken, parseQuickToken, tokenKey } from './token'

/** Query keys accepted for trade prefill (aliases for amount). */
export const SWAP_QUERY_KEYS = {
  from: 'from',
  to: 'to',
  amount: 'amount',
  chain: 'chain',
  source: 'source',
} as const

/** Chains this XRPL DEX app can honor for from/to resolution. */
const XRPL_CHAIN_ALIASES = new Set([
  '',
  'xrpl',
  'xrp',
  'ripple',
  'xrp-ledger',
  'xrp_ledger',
  'xrpledger',
])

/** Clearly non-XRPL chains — skip from/to (amount may still apply). */
const FOREIGN_CHAIN_ALIASES = new Set([
  'eth',
  'ethereum',
  'evm',
  'bsc',
  'bnb',
  'bnbbsc',
  'polygon',
  'matic',
  'arb',
  'arbitrum',
  'op',
  'optimism',
  'base',
  'avax',
  'avaxc',
  'sol',
  'solana',
  'xlm',
  'stellar',
  'btc',
  'bitcoin',
])

export type SwapDeeplinkParams = {
  from?: string
  to?: string
  amount?: string
  chain?: string
  source?: string
}

export type ResolvedSwapDeeplink = {
  fromToken?: Token
  toToken?: Token
  amount?: string
  chain?: string
  /** True when chain is missing or XRPL-family (from/to may be applied). */
  isXrplChain: boolean
  /** Raw params that were present. */
  raw: SwapDeeplinkParams
  hasTradePrefill: boolean
}

/**
 * Parse swap deeplink query params from a URL (or current location).
 * Does not touch ?xaman — Xaman resume stays independent.
 */
export function parseSwapDeeplink(
  href = typeof window !== 'undefined' ? window.location.href : '',
): SwapDeeplinkParams {
  try {
    const sp = new URL(href).searchParams
    const get = (k: string) => {
      const v = sp.get(k)
      return v != null && v.trim() !== '' ? v.trim() : undefined
    }
    // amount aliases used by some suite openers
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

export function isXrplChainParam(chain?: string | null): boolean {
  if (chain == null || chain === '') return true
  const c = chain.toLowerCase().trim()
  if (XRPL_CHAIN_ALIASES.has(c)) return true
  if (FOREIGN_CHAIN_ALIASES.has(c)) return false
  // Unknown chain: allow (this app is XRPL-only; prefer applying when plausible)
  return !/^(eth|sol|bnb|matic|arb|op|base|avax|xlm|btc)/i.test(c)
}

/** Validate positive finite amount string for pay field. */
export function normalizePayAmount(raw?: string | null): string | undefined {
  if (raw == null) return undefined
  const s = String(raw).trim().replace(/,/g, '')
  if (!s) return undefined
  // allow "10", "10.5", ".5"
  if (!/^\d*\.?\d+$/.test(s)) return undefined
  const n = parseFloat(s)
  if (!Number.isFinite(n) || n <= 0) return undefined
  // strip trailing zeros noise but keep user intent for small decimals
  return s
}

/**
 * Parse a token ref from query:
 * - XRP / xrp
 * - SYMBOL (catalog match)
 * - SYMBOL:issuer | SYMBOL.issuer | SYMBOL_issuer | SYMBOL issuer
 * - 40-hex currency (+ optional issuer)
 * - freeform via parseQuickToken
 */
export function parseTokenRef(ref: string): Token | null {
  const s = (ref || '').trim()
  if (!s) return null

  if (/^xrp$/i.test(s)) {
    return { ...NATIVE_XRP }
  }

  // SYMBOL + issuer with common separators
  const sep = s.match(
    /^([A-Za-z0-9]{1,12}|[A-Fa-f0-9]{40})\s*[:._\-|]\s*(r[1-9A-HJ-NP-Za-km-z]{24,})$/,
  )
  if (sep) {
    const curRaw = sep[1]
    const issuer = sep[2]
    const currency = /^[A-Fa-f0-9]{40}$/i.test(curRaw)
      ? curRaw.toUpperCase()
      : currencyToHex(curRaw)
    const symbol = /^[A-Fa-f0-9]{40}$/i.test(curRaw)
      ? curRaw.slice(0, 4).toUpperCase()
      : curRaw.toUpperCase().slice(0, 12)
    return normalizeToken({ symbol, currency, issuer, name: symbol })
  }

  // "SYMBOL rIssuer..." freeform
  const quick = parseQuickToken(s)
  if (quick && (quick.issuer || isXRP(quick) || quick.currency !== 'XRP')) {
    return quick
  }

  // Plain symbol / 3-char / hex currency only (issuer resolved from catalog later)
  if (/^[A-Za-z0-9]{1,12}$/.test(s) || /^[A-Fa-f0-9]{40}$/.test(s)) {
    const currency = /^[A-Fa-f0-9]{40}$/i.test(s) ? s.toUpperCase() : currencyToHex(s)
    const symbol = /^[A-Fa-f0-9]{40}$/i.test(s) ? s.slice(0, 4).toUpperCase() : s.toUpperCase()
    return normalizeToken({
      symbol,
      currency: symbol === 'XRP' && s.length <= 3 ? 'XRP' : currency,
      name: symbol,
    })
  }

  return quick
}

/**
 * Match a parsed token ref against the live catalog (prefer exact currency+issuer, then symbol).
 * Returns catalog token when found so logos/md5 carry over; otherwise returns the parsed token
 * when it has enough identity (XRP or issuer present).
 */
export function resolveTokenAgainstCatalog(
  ref: string | undefined,
  tokens: Token[] | null | undefined,
): Token | undefined {
  if (!ref) return undefined
  const parsed = parseTokenRef(ref)
  if (!parsed) return undefined

  if (isXRP(parsed)) return { ...NATIVE_XRP }

  const list = Array.isArray(tokens) ? tokens : []
  const key = tokenKey(parsed)

  // Exact currency|issuer
  if (parsed.issuer) {
    const exact = list.find((t) => tokenKey(t) === key)
    if (exact) return exact
    // currency match same issuer (hex vs iso)
    const sameIssuer = list.find(
      (t) =>
        t.issuer === parsed.issuer &&
        (t.currency === parsed.currency ||
          t.symbol?.toUpperCase() === parsed.symbol?.toUpperCase()),
    )
    if (sameIssuer) return sameIssuer
    // Structured enough to use without catalog
    return parsed
  }

  // Symbol / currency only — pick best catalog hit
  const sym = (parsed.symbol || '').toUpperCase()
  const bySymbol = list.filter(
    (t) =>
      (t.symbol || '').toUpperCase() === sym ||
      (t.currency || '').toUpperCase() === (parsed.currency || '').toUpperCase(),
  )
  if (bySymbol.length === 1) return bySymbol[0]
  if (bySymbol.length > 1) {
    // Prefer GateHub-style / highest volume already first in catalog order
    return bySymbol[0]
  }

  // No catalog match and no issuer — only accept if it is XRP (handled above)
  // Keep symbol-only custom so UI can still show selection; swap will need trustline.
  return parsed.currency && parsed.currency !== 'XRP' ? parsed : undefined
}

/**
 * Resolve full deeplink into form values.
 * When chain is foreign, from/to are omitted (amount may still be set).
 */
export function resolveSwapDeeplink(
  href = typeof window !== 'undefined' ? window.location.href : '',
  tokens: Token[] | null | undefined = [],
): ResolvedSwapDeeplink {
  const raw = parseSwapDeeplink(href)
  const amount = normalizePayAmount(raw.amount)
  const isXrpl = isXrplChainParam(raw.chain)
  const fromToken = isXrpl ? resolveTokenAgainstCatalog(raw.from, tokens) : undefined
  const toToken = isXrpl ? resolveTokenAgainstCatalog(raw.to, tokens) : undefined

  const hasTradePrefill = !!(fromToken || toToken || amount || raw.chain)

  return {
    fromToken,
    toToken,
    amount,
    chain: raw.chain,
    isXrplChain: isXrpl,
    raw,
    hasTradePrefill,
  }
}

/** True if URL has any swap trade prefill keys (ignores xaman-only returns). */
export function hasSwapDeeplink(
  href = typeof window !== 'undefined' ? window.location.href : '',
): boolean {
  const p = parseSwapDeeplink(href)
  return !!(p.from || p.to || p.amount || p.chain)
}
