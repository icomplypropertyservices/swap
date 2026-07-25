import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import type { Token } from '../types'
import TokenLogo from './TokenLogo'
import { tokenKey } from '../utils/token'

interface TokenStripProps {
  tokens: Token[]
  onAddToken: () => void
  onPickToken: (t: Token) => void
}

export default function TokenStrip({ tokens, onAddToken, onPickToken }: TokenStripProps) {
  const topTokens = useMemo(() => tokens.slice(0, 14), [tokens])

  return (
    <div className="max-w-[460px] mx-auto mt-8">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="uppercase text-[10px] tracking-[2px] text-slate-500">
          Top tokens from xrpl.to + customs
        </div>
        <button
          onClick={onAddToken}
          className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 font-medium"
        >
          <Plus size={13} /> ADD ANY TOKEN
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {topTokens.map((t) => (
          <button
            key={tokenKey(t)}
            onClick={() => onPickToken(t)}
            className="px-3 py-1 bg-[#0f1117] border border-[#23262f] hover:border-blue-900 rounded-2xl text-xs flex items-center gap-1.5 active:bg-[#16181f]"
          >
            <TokenLogo token={t} size={15} />
            <span className="font-medium">{t.symbol}</span>
          </button>
        ))}
      </div>
      <div className="text-[10px] text-slate-600 mt-2 px-1">
        Can't find it? Use the <span className="text-blue-400">ADD ANY TOKEN</span> button
        (supports FUZZY + any other).
      </div>
    </div>
  )
}
