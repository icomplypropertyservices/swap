import type { Token } from '../types'

// XRP is the only minimal native we keep - everything else comes from xrpl.to at runtime
export const NATIVE_XRP: Token = { symbol: 'XRP', currency: 'XRP', name: 'XRP - Native' }

export const XRPL_WS = 'wss://xrplcluster.com'
export const XUMM_API = 'https://xumm.app/api/v1/platform/payload'

export function currencyToHex(cur: string): string {
  if (!cur || cur === 'XRP') return 'XRP'
  if (cur.length > 3) return cur.toUpperCase()
  // 3 letter code -> 40 char hex padded
  const hex = Array.from(cur)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
  return hex.padEnd(40, '0')
}

export function isXRP(token: Token): boolean {
  // Only native XRP — never treat IOUs missing issuer as XRP
  return token.currency === 'XRP' && !token.issuer
}
