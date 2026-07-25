import { useState, useEffect, useRef, useMemo, useCallback, type UIEvent } from 'react'
import type { Token } from '../types'
import TokenLogo from './TokenLogo'
import { filterTokensLocal, tokenKey } from '../utils/token'
import TokenDropdownMenu, {
  TOKEN_ROW_H,
  TOKEN_VIEWPORT_H,
} from './feature/swap/TokenDropdownMenu'

interface TokenDropdownProps {
  tokens: Token[]
  selected: Token
  onSelect: (t: Token) => void
  onAddNew: (prefillSearch?: string) => void
  /** Optional remote search — when provided, results merge with local filter */
  onSearch?: (query: string) => Promise<Token[]>
}

const OVERSCAN = 6
const MAX_RESULTS = 80

export default function TokenDropdown({
  tokens,
  selected,
  onSelect,
  onAddNew,
  onSearch,
}: TokenDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [remoteResults, setRemoteResults] = useState<Token[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const searchSeq = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  const issuerHint = selected.issuer ? selected.issuer.slice(0, 4) + '…' : ''
  const display = selected.symbol + (selected.issuer ? ' • ' + issuerHint : '')

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
        setRemoteResults(null)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    if (open && searchRef.current) {
      const t = setTimeout(() => searchRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
    if (!open) {
      setSearch('')
      setRemoteResults(null)
      setIsSearching(false)
      setScrollTop(0)
    }
  }, [open])

  // Debounced remote search — never fires on empty / whitespace-only query
  useEffect(() => {
    const q = search.trim()
    if (!open || !q || !onSearch) {
      setRemoteResults(null)
      setIsSearching(false)
      return
    }

    const seq = ++searchSeq.current
    setIsSearching(true)
    const timer = setTimeout(async () => {
      if (!search.trim()) {
        if (searchSeq.current === seq) {
          setRemoteResults(null)
          setIsSearching(false)
        }
        return
      }
      try {
        const results = await onSearch(q)
        if (searchSeq.current === seq) {
          setRemoteResults(results)
        }
      } catch {
        if (searchSeq.current === seq) setRemoteResults(null)
      } finally {
        if (searchSeq.current === seq) setIsSearching(false)
      }
    }, 320)

    return () => clearTimeout(timer)
  }, [search, open, onSearch])

  const q = search.toLowerCase().trim()

  const filtered = useMemo(() => {
    const tokenList = Array.isArray(tokens) ? tokens : []
    const localFiltered = q ? filterTokensLocal(tokenList, q) : tokenList
    if (q && Array.isArray(remoteResults)) {
      const safeRemote = remoteResults.filter(
        (t): t is Token => !!t && typeof t === 'object' && !!t.symbol
      )
      const seen = new Set(safeRemote.map(tokenKey))
      const rest = localFiltered.filter((t) => t && !seen.has(tokenKey(t)))
      return [...safeRemote, ...rest].slice(0, MAX_RESULTS)
    }
    return localFiltered.filter((t) => !!t && typeof t === 'object').slice(0, MAX_RESULTS)
  }, [q, tokens, remoteResults])

  const virtual = useMemo(() => {
    const total = filtered.length
    if (total === 0) {
      return { total: 0, start: 0, end: 0, offsetY: 0, height: 0, items: [] as Token[] }
    }
    const visibleCount = Math.ceil(TOKEN_VIEWPORT_H / TOKEN_ROW_H) + OVERSCAN * 2
    const start = Math.max(0, Math.floor(scrollTop / TOKEN_ROW_H) - OVERSCAN)
    const end = Math.min(total, start + visibleCount)
    return {
      total,
      start,
      end,
      offsetY: start * TOKEN_ROW_H,
      height: total * TOKEN_ROW_H,
      items: filtered.slice(start, end),
    }
  }, [filtered, scrollTop])

  const handleScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const handleSelect = (t: Token) => {
    if (!t) return
    onSelect(t)
    setOpen(false)
    setSearch('')
    setRemoteResults(null)
  }

  const closeAndReset = () => {
    setOpen(false)
    setSearch('')
    setRemoteResults(null)
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="token-btn"
        aria-expanded={open}
      >
        <TokenLogo token={selected} size={28} />
        <span>{display}</span>
        <span className="chev">▼</span>
      </button>

      {open && (
        <TokenDropdownMenu
          search={search}
          onSearchChange={setSearch}
          searchRef={searchRef}
          listRef={listRef}
          isSearching={isSearching}
          filtered={filtered}
          selected={selected}
          remoteResults={remoteResults}
          q={q}
          virtual={virtual}
          onScroll={handleScroll}
          onSelect={handleSelect}
          onQuickAdd={(s) => {
            closeAndReset()
            onAddNew(s)
          }}
          onAddCustom={() => {
            closeAndReset()
            onAddNew()
          }}
        />
      )}
    </div>
  )
}
