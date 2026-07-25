import { useEffect, useMemo, useState } from 'react'
import type { Token } from '../types'
import { getTokenLogoCandidates } from '../utils/token'
import LetterAvatar from './feature/swap/LetterAvatar'

interface TokenLogoProps {
  token: Token
  size?: number
}

const FALLBACK: Token = { symbol: '??', currency: 'XRP' }

/** Session-level: skip URLs that already failed to reduce CDN stampede / 429 loops. */
const failedLogoUrls = new Set<string>()
const okLogoUrls = new Set<string>()

function firstUsableIndex(candidates: string[]): number {
  for (let i = 0; i < candidates.length; i++) {
    if (okLogoUrls.has(candidates[i])) return i
  }
  for (let i = 0; i < candidates.length; i++) {
    if (!failedLogoUrls.has(candidates[i])) return i
  }
  return candidates.length // all failed → letter avatar
}

export default function TokenLogo({ token, size = 22 }: TokenLogoProps) {
  // Guard missing token (empty search / race) — letter avatar fallback
  const safe = token || FALLBACK
  const candidates = useMemo(
    () => getTokenLogoCandidates(safe),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [safe.currency, safe.issuer, safe.logo, safe.md5, safe.ext]
  )
  const [idx, setIdx] = useState(() => firstUsableIndex(candidates))

  useEffect(() => {
    setIdx(firstUsableIndex(candidates))
  }, [candidates])

  if (!candidates.length || idx >= candidates.length) {
    return <LetterAvatar token={safe} size={size} />
  }

  const src = candidates[idx]
  return (
    <img
      src={src}
      alt={safe.symbol}
      className="rounded-full object-contain bg-[#0a0c12] ring-1 ring-inset ring-white/10 flex-shrink-0"
      style={{ width: size, height: size }}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => {
        okLogoUrls.add(src)
      }}
      onError={() => {
        failedLogoUrls.add(src)
        setIdx((i) => {
          let next = i + 1
          while (next < candidates.length && failedLogoUrls.has(candidates[next])) next++
          return next
        })
      }}
    />
  )
}
