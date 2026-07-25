import { useEffect, useMemo, useState } from 'react'
import type { Token } from '../types'
import { getTokenLogoCandidates } from '../utils/token'
import LetterAvatar from './feature/swap/LetterAvatar'

interface TokenLogoProps {
  token: Token
  size?: number
}

const FALLBACK: Token = { symbol: '??', currency: 'XRP' }

export default function TokenLogo({ token, size = 22 }: TokenLogoProps) {
  const safe = token || FALLBACK
  const candidates = useMemo(
    () => getTokenLogoCandidates(safe),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [safe.currency, safe.issuer, safe.logo, safe.md5, safe.ext, safe.symbol],
  )
  // Per-mount only — do not permanently fail URLs (429s are transient)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setIdx(0)
  }, [candidates])

  if (!candidates.length || idx >= candidates.length) {
    return <LetterAvatar token={safe} size={size} />
  }

  const src = candidates[idx]
  return (
    <img
      src={src}
      alt={safe.symbol}
      className="rounded-full object-cover bg-[#0a0c12] ring-1 ring-inset ring-white/10 flex-shrink-0"
      style={{ width: size, height: size }}
      loading="lazy"
      decoding="async"
      onError={() => setIdx((i) => i + 1)}
    />
  )
}
