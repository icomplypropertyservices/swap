import type { Token } from '../types'
import { currencyToHex } from './xrpl'

// Parse freeform input for quick add e.g. "FUZZY rJvv..." or "ABC: rxxxx" or "4655... rxxxx"
export function parseQuickToken(input: string): Token | null {
  const s = input.trim()
  if (!s) return null
  const parts = s.split(/[\s:]+/).filter(Boolean)
  if (parts.length === 0) return null

  // Find issuer anywhere (starts with r + reasonable length)
  const issuer = parts.find((p) => /^r[0-9A-Za-z]{25,}$/.test(p))
  // Find 40-hex currency anywhere
  const currencyPart = parts.find((p) => /^[A-F0-9]{40}$/i.test(p))
  // Symbol is first non-issuer non-hex chunk
  const symCandidate =
    parts.find((p) => !/^r[0-9A-Za-z]/.test(p) && !/^[A-F0-9]{40}$/i.test(p)) || parts[0]
  const symbol = (symCandidate || 'UNK').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'UNK'

  let currency = currencyPart || parts.find((p) => p.length <= 3 && /^[A-Z0-9]{3}$/i.test(p)) || symbol

  if (!/^[A-F0-9]{40}$/i.test(currency)) {
    currency = currencyToHex(currency)
  } else {
    currency = currency.toUpperCase()
  }

  return normalizeToken({
    symbol,
    currency,
    issuer,
    name: symbol,
  })
}

// --- Token visuals helpers (guarantees image/avatar for EVERY token, including customs) ---

/** Native XRP — no md5 on ledger; use stable public icons. */
export const XRP_LOGO_CANDIDATES = [
  'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
  'https://cryptologos.cc/logos/xrp-xrp-logo.png?v=040',
]

/** Canonical thumb host — never use bithomp or bare xrpl.to/thumb (404). */
export function thumbUrl(md5: string, w?: number): string {
  const base = `https://api.xrpl.to/v1/thumb/${encodeURIComponent(md5)}`
  // Bare URL is most reliable; optional w can 429 under load
  return w ? `${base}?w=${w}` : base
}

/** Reject known-bad / third-party logo hosts we do not want in the UI. */
function isBlockedLogoUrl(u: string): boolean {
  if (/bithomp\.com/i.test(u)) return true
  // s1 hotlink often 403s and burns rate limits
  if (/s1\.xrpl\.to/i.test(u)) return true
  // Website path /thumb/{md5} returns 404; only api.xrpl.to/v1/thumb is valid.
  if (/xrpl\.to\/thumb\//i.test(u) && !/api\.xrpl\.to\/v1\/thumb\//i.test(u)) return true
  return false
}

export function getTokenColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 68%, 42%)`
}

/** Build candidate logo URLs for a token (first working one wins in TokenLogo). */
export function getTokenLogoCandidates(
  token: Pick<Token, 'logo' | 'md5' | 'ext' | 'symbol' | 'issuer' | 'currency'> | null | undefined
): string[] {
  if (!token) return []
  const out: string[] = []
  const push = (u?: string) => {
    if (!u || typeof u !== 'string' || !/^https?:\/\//i.test(u)) return
    if (isBlockedLogoUrl(u)) return
    if (out.includes(u)) return
    out.push(u)
  }

  // Native XRP has no ledger md5
  if (token.currency === 'XRP' && !token.issuer) {
    for (const u of XRP_LOGO_CANDIDATES) push(u)
    push(token.logo)
    return out
  }

  const md5 =
    token.md5 ||
    (typeof token.logo === 'string' ? token.logo.match(/([a-f0-9]{32})/i)?.[1] : undefined)

  // Prefer bare API thumb first (most reliable under rate limits)
  if (md5) {
    push(thumbUrl(md5))
    push(thumbUrl(md5, 32))
  }

  // Explicit logo only when not a blocked host
  push(token.logo)

  return out
}

/**
 * normalizeToken: ALL data sources (api search, custom add, parse, balances) MUST flow through this.
 * Ensures correct Token shape + best-effort logo from xrpl.to md5/ext.
 */
export function normalizeToken(raw: any): Token {
  if (!raw || typeof raw !== 'object') return { symbol: 'UNK', currency: 'XRP' }

  const md5: string | undefined =
    (typeof raw.md5 === 'string' && raw.md5) ||
    (typeof raw._id === 'string' && /^[a-f0-9]{32}$/i.test(raw._id) ? raw._id : undefined) ||
    (typeof raw.hashicon === 'string' && /^[a-f0-9]{32}$/i.test(raw.hashicon)
      ? raw.hashicon
      : undefined) ||
    (typeof raw.logo === 'string' ? raw.logo.match(/([a-f0-9]{32})/i)?.[1] : undefined) ||
    (typeof raw.icon === 'string' ? raw.icon.match(/([a-f0-9]{32})/i)?.[1] : undefined) ||
    undefined

  const ext: string | undefined = raw.ext ? String(raw.ext).replace(/^\./, '') : undefined

  // Explicit absolute image URLs — drop blocked hosts (bithomp, s1, bare /thumb)
  const explicit =
    [raw.logo, raw.icon, raw.image, raw.logoURI, raw.hashicon].find(
      (u) => typeof u === 'string' && /^https?:\/\//i.test(u) && !isBlockedLogoUrl(u)
    ) || undefined

  let logo: string | undefined = explicit
  // When md5 is known, use bare canonical API thumb (no w= — avoids 429 storms)
  if (md5) {
    logo = thumbUrl(md5)
  }

  const symbolRaw = raw.symbol || raw.name || raw.currency || 'UNK'
  let symbol = String(symbolRaw).toUpperCase().slice(0, 12)
  // If currency is hex and name is human, prefer name for display symbol
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

// Alias for compatibility across trading/nft/games data flows
export const normalizeXrplToken = normalizeToken

/** Token key for de-dupe maps */
export function tokenKey(t: Pick<Token, 'currency' | 'issuer'> | null | undefined): string {
  if (!t) return '|'
  return `${t.currency || ''}|${t.issuer || ''}`
}

/** Rank: exact symbol > name exact > symbol prefix > name prefix > contains > issuer/currency > fuzzy */
function matchRank(t: Token, q: string): number {
  const sym = (t.symbol || '').toLowerCase()
  const name = (t.name || '').toLowerCase()
  if (sym === q) return 0
  if (name === q) return 1
  if (sym.startsWith(q)) return 2
  if (name.startsWith(q)) return 3
  if (sym.includes(q) || name.includes(q)) return 4
  if ((t.issuer || '').toLowerCase().includes(q)) return 5
  if ((t.currency || '').toLowerCase().includes(q)) return 6
  return 7
}

/** Local fuzzy filter used by dropdown + remote merge. Safe for empty / non-array inputs. */
export function filterTokensLocal(tokens: Token[] | null | undefined, query: string): Token[] {
  if (!Array.isArray(tokens) || tokens.length === 0) return []
  const q = (query || '').toLowerCase().trim()
  if (!q) return tokens
  const hits = tokens.filter((t) => {
    if (!t || typeof t !== 'object') return false
    const hay = `${t.symbol || ''} ${t.name || ''} ${t.issuer || ''} ${t.currency || ''}`.toLowerCase()
    if (hay.includes(q)) return true
    let idx = 0
    for (const ch of q) {
      idx = hay.indexOf(ch, idx)
      if (idx === -1) return false
      idx++
    }
    return true
  })
  return hits.sort((a, b) => matchRank(a, q) - matchRank(b, q))
}
