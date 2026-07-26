import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import {
  fetchActiveCreative,
  type AdCreative,
  type AdSlotId,
} from '../lib/ads'

export interface AdSlotProps {
  /** Placement id — swap.banner (default) or swap.sidebar */
  slot?: AdSlotId
  /** Visual layout */
  variant?: 'banner' | 'sidebar'
  className?: string
  /** When false, hide mock fallback and show nothing if API fails */
  useMockFallback?: boolean
}

/**
 * Sponsored area: loads active creative from ads API and renders a labeled card.
 * Click opens clickUrl in a new tab. Never blocks swap/Xaman flows.
 */
export default function AdSlot({
  slot = 'swap.banner',
  variant = 'banner',
  className = '',
  useMockFallback = true,
}: AdSlotProps) {
  const [creative, setCreative] = useState<AdCreative | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const ac = new AbortController()
    let alive = true
    setLoaded(false)
    fetchActiveCreative(slot, { signal: ac.signal, useMockFallback })
      .then((c) => {
        if (alive) setCreative(c)
      })
      .finally(() => {
        if (alive) setLoaded(true)
      })
    return () => {
      alive = false
      ac.abort()
    }
  }, [slot, useMockFallback])

  if (!loaded || !creative) return null

  const isSidebar = variant === 'sidebar' || slot === 'swap.sidebar'
  const label = creative.sponsor ? `Sponsored · ${creative.sponsor}` : 'Sponsored'

  if (isSidebar) {
    return (
      <aside
        className={`ad-slot ad-slot--sidebar rounded-2xl border border-[#23262f] bg-[#0f1117] overflow-hidden ${className}`}
        data-slot={slot}
        data-ad-id={creative.id}
        aria-label="Sponsored"
      >
        <div className="px-3 pt-2.5 pb-1 flex items-center justify-between gap-2">
          <span className="text-[9px] uppercase tracking-[1.4px] font-semibold text-slate-500">
            {label}
          </span>
        </div>
        <a
          href={creative.clickUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="block px-3 pb-3 no-underline text-inherit group"
        >
          {creative.imageUrl && (
            <img
              src={creative.imageUrl}
              alt=""
              className="w-full h-24 object-cover rounded-xl mb-2.5 ring-1 ring-white/5"
              loading="lazy"
              decoding="async"
            />
          )}
          <div className="font-semibold text-sm text-slate-100 group-hover:text-blue-300 transition-colors leading-snug">
            {creative.title}
          </div>
          {creative.body && (
            <p className="mt-1 text-[11px] text-slate-400 leading-relaxed line-clamp-3">
              {creative.body}
            </p>
          )}
          <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-400">
            {creative.cta || 'Learn more'}
            <ExternalLink size={11} aria-hidden />
          </span>
        </a>
      </aside>
    )
  }

  return (
    <div
      className={`ad-slot ad-slot--banner mb-4 rounded-2xl border border-[#23262f] bg-[#0f1117] overflow-hidden ${className}`}
      data-slot={slot}
      data-ad-id={creative.id}
      aria-label="Sponsored"
    >
      <div className="px-3.5 pt-2 pb-0 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[1.4px] font-semibold text-slate-500">
          {label}
        </span>
      </div>
      <a
        href={creative.clickUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="flex items-center gap-3 sm:gap-4 px-3.5 pb-3 pt-1.5 no-underline text-inherit group min-w-0"
      >
        {creative.imageUrl && (
          <img
            src={creative.imageUrl}
            alt=""
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-cover ring-1 ring-white/10 shrink-0"
            loading="lazy"
            decoding="async"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm sm:text-[15px] text-slate-100 group-hover:text-blue-300 transition-colors truncate">
            {creative.title}
          </div>
          {creative.body && (
            <p className="mt-0.5 text-[11px] sm:text-xs text-slate-400 line-clamp-2 leading-relaxed">
              {creative.body}
            </p>
          )}
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 shrink-0 px-3 py-1.5 rounded-xl bg-[#111318] border border-[#2a2e38] text-[11px] font-medium text-blue-400 group-hover:border-blue-500/40 group-hover:bg-[#16181f] transition-colors">
          {creative.cta || 'Open'}
          <ExternalLink size={12} aria-hidden />
        </span>
      </a>
    </div>
  )
}
