import { useState, useEffect } from 'react'
import type { Token } from '../types'
import { normalizeToken, parseQuickToken } from '../utils/token'
import { toast } from 'sonner'

interface AddTokenModalProps {
  open: boolean
  onClose: () => void
  onAdd: (token: Token) => void
  initialSearch?: string
}

export default function AddTokenModal({ open, onClose, onAdd, initialSearch }: AddTokenModalProps) {
  const [customSymbol, setCustomSymbol] = useState('')
  const [customCurrency, setCustomCurrency] = useState('')
  const [customIssuer, setCustomIssuer] = useState('')
  const [customLogo, setCustomLogo] = useState('')

  // Prefill from quick-add search string when modal opens
  useEffect(() => {
    if (!open) return
    if (!initialSearch?.trim()) {
      setCustomSymbol('')
      setCustomCurrency('')
      setCustomIssuer('')
      setCustomLogo('')
      return
    }
    const parsed = parseQuickToken(initialSearch)
    if (parsed) {
      setCustomSymbol(parsed.symbol || '')
      setCustomCurrency(parsed.currency === 'XRP' ? '' : parsed.currency || '')
      setCustomIssuer(parsed.issuer || '')
    } else {
      setCustomSymbol(initialSearch.trim().toUpperCase().slice(0, 12))
    }
  }, [open, initialSearch])

  const handleAdd = () => {
    if (!customSymbol || !customCurrency) {
      toast.error('Symbol and Currency required')
      return
    }

    const newTok: Token = normalizeToken({
      symbol: customSymbol,
      currency: customCurrency,
      issuer: customIssuer || undefined,
      name: `${customSymbol} (custom)`,
      logo: customLogo || undefined,
    })

    if (newTok.currency !== 'XRP' && !newTok.issuer) {
      toast.error('Issuer r-address is required for non-XRP tokens')
      return
    }

    onAdd(newTok)
    setCustomSymbol('')
    setCustomCurrency('')
    setCustomIssuer('')
    setCustomLogo('')
    onClose()
  }

  const handleClose = () => {
    setCustomSymbol('')
    setCustomCurrency('')
    setCustomIssuer('')
    setCustomLogo('')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4" onClick={handleClose}>
      <div
        className="bg-[#0f1117] border border-[#23262f] w-full max-w-md rounded-3xl p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xl font-semibold tracking-tight">Add any token</div>
        <div className="text-sm text-slate-400 mt-1">
          Works for FUZZY and every other token on XRPL. Get currency + issuer from xrpl.to or xrpscan.
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <div className="text-xs text-slate-500 mb-1">SYMBOL</div>
            <input
              className="w-full bg-black border border-[#2a2e38] rounded-2xl px-4 py-3 text-lg outline-none focus:border-blue-600"
              placeholder="FUZZY"
              value={customSymbol}
              onChange={(e) => setCustomSymbol(e.target.value)}
            />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">CURRENCY (3 letters or full 40 hex)</div>
            <input
              className="w-full bg-black border border-[#2a2e38] rounded-2xl px-4 py-3 font-mono text-sm outline-none focus:border-blue-600"
              placeholder="46555A5A59... or FUZ"
              value={customCurrency}
              onChange={(e) => setCustomCurrency(e.target.value)}
            />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">ISSUER (r-address)</div>
            <input
              className="w-full bg-black border border-[#2a2e38] rounded-2xl px-4 py-3 font-mono text-sm outline-none focus:border-blue-600"
              placeholder="rJvv1w9R4p5j2H3..."
              value={customIssuer}
              onChange={(e) => setCustomIssuer(e.target.value)}
            />
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">LOGO URL (optional)</div>
            <input
              className="w-full bg-black border border-[#2a2e38] rounded-2xl px-4 py-2.5 text-xs outline-none focus:border-blue-600"
              placeholder="https://..."
              value={customLogo}
              onChange={(e) => setCustomLogo(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button type="button" onClick={handleClose} className="flex-1 py-3 rounded-2xl border border-[#2a2e38] active:bg-black">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 font-semibold"
          >
            Add &amp; Use Token
          </button>
        </div>
        <div className="text-center text-[10px] text-slate-500 mt-4">
          After adding you can instantly select it from either dropdown.
        </div>
      </div>
    </div>
  )
}
