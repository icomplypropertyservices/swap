import { Plus, Loader2 } from 'lucide-react'
import type { Token } from '../../../types'
import type { RefObject, UIEvent } from 'react'
import TokenLogo from '../../TokenLogo'
import { tokenKey } from '../../../utils/token'

export const TOKEN_ROW_H = 52
export const TOKEN_VIEWPORT_H = 340

interface VirtualSlice {
  total: number
  start: number
  end: number
  offsetY: number
  height: number
  items: Token[]
}

interface TokenDropdownMenuProps {
  search: string
  onSearchChange: (value: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  listRef: RefObject<HTMLDivElement | null>
  isSearching: boolean
  filtered: Token[]
  selected: Token
  remoteResults: Token[] | null
  q: string
  virtual: VirtualSlice
  onScroll: (e: UIEvent<HTMLDivElement>) => void
  onSelect: (t: Token) => void
  onQuickAdd: (search: string) => void
  onAddCustom: () => void
}

/** Open panel for TokenDropdown: search, virtualized results, quick-add / custom add. */
export default function TokenDropdownMenu({
  search,
  onSearchChange,
  searchRef,
  listRef,
  isSearching,
  filtered,
  selected,
  remoteResults,
  q,
  virtual,
  onScroll,
  onSelect,
  onQuickAdd,
  onAddCustom,
}: TokenDropdownMenuProps) {
  return (
    <div className="token-dropdown absolute right-0 mt-2 w-[min(calc(100vw-2.5rem),320px)] bg-[#0f1117] border border-[#2a2e38] shadow-2xl z-[80] overflow-hidden text-sm rounded-2xl">
      <div className="p-2.5 border-b border-[#23262f] bg-[#0f1117] sticky top-0 z-10">
        <div className="relative">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search symbol, name or issuer..."
            className="search-input w-full rounded-xl px-3 py-2 text-sm placeholder:text-slate-500"
          />
          {isSearching && (
            <Loader2
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
            />
          )}
        </div>
        {q && (
          <div className="text-[10px] text-slate-400 mt-1 px-1">
            {filtered.length} result{filtered.length === 1 ? '' : 's'}
            {isSearching
              ? ' · searching xrpl.to…'
              : Array.isArray(remoteResults)
                ? filtered.length === 0
                  ? ' · no matches'
                  : ' · live + local'
                : ' · local'}
          </div>
        )}
      </div>

      <div
        ref={listRef}
        className="overflow-auto py-1"
        style={{ maxHeight: TOKEN_VIEWPORT_H }}
        onScroll={onScroll}
      >
        {filtered.length === 0 ? (
          <div className="px-4 py-4 text-xs text-slate-500">
            {isSearching
              ? 'Searching…'
              : q
                ? 'No matches — try another symbol, or quick-add below.'
                : 'No tokens loaded yet.'}
          </div>
        ) : (
          <div style={{ height: virtual.height, position: 'relative' }}>
            <div style={{ transform: `translateY(${virtual.offsetY}px)` }}>
              {virtual.items.map((t, i) => {
                if (!t) return null
                const idx = virtual.start + i
                const key = `${tokenKey(t)}-${idx}`
                const isSel =
                  t.symbol === selected.symbol &&
                  t.issuer === selected.issuer &&
                  t.currency === selected.currency
                return (
                  <button
                    type="button"
                    key={key}
                    onClick={() => onSelect(t)}
                    className={`w-full text-left px-3 py-2.5 hover:bg-[#16181f] flex items-center gap-3 transition-colors ${isSel ? 'bg-[#16181f]' : ''}`}
                    style={{ height: TOKEN_ROW_H }}
                  >
                    <TokenLogo token={t} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-[15px]">{t.symbol}</span>
                        {t.name && t.name.toUpperCase() !== t.symbol && (
                          <span className="text-xs text-slate-400 truncate">{t.name}</span>
                        )}
                      </div>
                      {t.issuer && (
                        <div className="font-mono text-[10px] text-slate-500 truncate mt-px">
                          {t.issuer}
                        </div>
                      )}
                    </div>
                    {isSel && <span className="text-emerald-400 text-xs self-center">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {q && (
          <button
            type="button"
            onClick={() => onQuickAdd(search)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm bg-[#16181f] hover:bg-emerald-900/30 border-t border-[#23262f] text-emerald-400 font-medium"
          >
            <Plus size={16} /> Quick-add “{search}” — enter issuer if needed
          </button>
        )}
      </div>

      <div className="border-t border-[#23262f] bg-[#0f1117]">
        <button
          type="button"
          onClick={onAddCustom}
          className="w-full text-left px-4 py-[11px] flex items-center gap-2 text-blue-400 hover:bg-[#16181f] text-sm font-medium"
        >
          <Plus size={16} /> Add custom token (currency + issuer from xrpl.to)
        </button>
      </div>
    </div>
  )
}
