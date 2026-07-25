import type { Token } from '../../../types'
import { getTokenColor } from '../../../utils/token'

interface LetterAvatarProps {
  token: Token
  size: number
}

/** Fallback avatar when no logo image is available. */
export default function LetterAvatar({ token, size }: LetterAvatarProps) {
  const bg = getTokenColor(token.symbol + (token.issuer || ''))
  const letters = (token.symbol || '??').slice(0, 2).toUpperCase()
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold ring-1 ring-inset ring-white/10 flex-shrink-0"
      style={{ width: size, height: size, background: bg, fontSize: Math.max(9, size * 0.42) + 'px' }}
      title={token.name || token.symbol}
    >
      {letters}
    </div>
  )
}
