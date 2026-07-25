import { useState, useEffect, useCallback, useRef } from 'react'
import type { Token } from '../types'
import { NATIVE_XRP } from '../utils/xrpl'
import { normalizeToken, tokenKey, filterTokensLocal } from '../utils/token'

const CUSTOM_KEY = 'customTokens'
// v1 docs: sort=vol24hxrp, limit max 100. Legacy /api kept as fallback.
const XRPLTO_TOKENS_V1 = 'https://api.xrpl.to/v1/tokens?limit=100&sort=vol24hxrp&order=desc'
const XRPLTO_TOKENS_LEGACY = 'https://api.xrpl.to/api/tokens?limit=100&sortBy=vol24h&sortType=desc'
// Docs: POST /v1/search body = { search, offset?, limit? }  — NOT "query"
const XRPLTO_SEARCH = 'https://api.xrpl.to/v1/search'
const XRPLTO_FILTER = 'https://api.xrpl.to/v1/tokens'

function loadCustoms(): Token[] {
  try {
    const saved = localStorage.getItem(CUSTOM_KEY)
    if (!saved) return []
    const parsed = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []
    return parsed.map((t: any) => normalizeToken(t)).filter((t: Token) => t.currency !== 'XRP')
  } catch {
    return []
  }
}

function saveCustoms(customs: Token[]) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(customs))
}

function mergeTokens(base: Token[], extra: Token[]): Token[] {
  const seen = new Set(base.map(tokenKey))
  const out = [...base]
  for (const t of extra) {
    const k = tokenKey(t)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

function extractTokenList(j: any): any[] {
  if (Array.isArray(j?.tokens)) return j.tokens
  if (Array.isArray(j?.results)) return j.results
  return []
}

/** POST /v1/search with correct body field (`search`). */
async function remoteSearchPost(q: string): Promise<Token[] | null> {
  const res = await fetch(XRPLTO_SEARCH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    // CRITICAL: API expects `search`, not `query`. Wrong key returns trending junk.
    body: JSON.stringify({ search: q, limit: 25 }),
  })
  if (!res.ok) return null
  const j = await res.json().catch(() => null)
  const raw = extractTokenList(j)
  if (!raw.length) return []
  return raw
    .filter((t) => t != null && typeof t === 'object')
    .map((t) => normalizeToken(t))
    .filter((t) => t.symbol && t.currency && t.symbol !== 'UNK')
}

/** GET /v1/tokens?filter= as fallback when POST search is rate-limited. */
async function remoteSearchFilter(q: string): Promise<Token[] | null> {
  const url = `${XRPLTO_FILTER}?filter=${encodeURIComponent(q)}&limit=25`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const j = await res.json().catch(() => null)
  const raw = extractTokenList(j)
  if (!raw.length) return []
  return raw
    .filter((t) => t != null && typeof t === 'object')
    .map((t) => normalizeToken(t))
    .filter((t) => t.symbol && t.currency && t.symbol !== 'UNK')
}

export function useTokens() {
  const customsRef = useRef<Token[]>(loadCustoms())
  const [tokens, setTokens] = useState<Token[]>(() => [NATIVE_XRP, ...customsRef.current])
  const [isLoadingTokens, setIsLoadingTokens] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Stable snapshot for search — avoids recreating searchTokens on every catalog merge
  const tokensRef = useRef(tokens)
  tokensRef.current = tokens

  // Load live top tokens from xrpl.to (volume sorted). Do NOT persist API list as customs.
  useEffect(() => {
    let cancelled = false
    setIsLoadingTokens(true)
    setLoadError(null)

    const load = async () => {
      let lastErr: Error | null = null
      for (const url of [XRPLTO_TOKENS_V1, XRPLTO_TOKENS_LEGACY]) {
        try {
          const r = await fetch(url, { headers: { Accept: 'application/json' } })
          if (!r.ok) throw new Error(`tokens HTTP ${r.status}`)
          const j = await r.json()
          if (cancelled) return
          const list = extractTokenList(j)
          if (!list.length) {
            lastErr = new Error('No tokens returned from xrpl.to')
            continue
          }
          const mapped: Token[] = list.map((t: any) => normalizeToken(t))
          setTokens(mergeTokens([NATIVE_XRP, ...customsRef.current], mapped))
          return
        } catch (e: any) {
          lastErr = e instanceof Error ? e : new Error(String(e?.message || e))
        }
      }
      if (!cancelled) setLoadError(lastErr?.message || 'Failed to load tokens')
    }

    load().finally(() => {
      if (!cancelled) setIsLoadingTokens(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const addCustomToken = useCallback((newTok: Token) => {
    const normalized = normalizeToken(newTok)
    setTokens((curr) => {
      const exists = curr.some((t) => tokenKey(t) === tokenKey(normalized))
      if (exists) return curr
      return [...curr, normalized]
    })
    // Persist only user-added customs
    const nextCustoms = mergeTokens(customsRef.current, [normalized]).filter(
      (t) => t.currency !== 'XRP'
    )
    customsRef.current = nextCustoms
    saveCustoms(nextCustoms)
  }, [])

  /**
   * Search tokens: local filter first, then remote POST /v1/search { search }.
   * Falls back to GET /v1/tokens?filter= on rate-limit/error.
   * Stable callback identity so dropdown debounce effects do not re-fire on catalog updates.
   */
  const searchTokens = useCallback(async (query: string): Promise<Token[]> => {
    const q = (query || '').trim()
    const catalog = Array.isArray(tokensRef.current) ? tokensRef.current : []
    // Empty query → full catalog (never null). No remote spam.
    if (!q) return catalog

    const localHits = filterTokensLocal(catalog, q)

    try {
      let remote: Token[] | null = null
      try {
        remote = await remoteSearchPost(q)
      } catch {
        remote = null
      }

      // Rate-limit / network → try name filter endpoint
      if (remote === null) {
        try {
          remote = await remoteSearchFilter(q)
        } catch {
          remote = null
        }
      }

      if (remote === null || !remote.length) return localHits

      // Merge remote into catalog only when there are genuinely new keys
      setTokens((curr) => {
        const merged = mergeTokens(curr, remote!)
        return merged.length === curr.length ? curr : merged
      })

      // Prefer tokens that actually match the query text
      const remoteMatched = filterTokensLocal(remote, q)
      const combined = mergeTokens(localHits, remoteMatched.length ? remoteMatched : remote)
      return Array.isArray(combined) ? combined : localHits
    } catch {
      return localHits
    }
  }, [])

  return {
    tokens,
    setTokens,
    addCustomToken,
    searchTokens,
    isLoadingTokens,
    loadError,
  }
}
