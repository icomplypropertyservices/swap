import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ExternalLink, Wallet } from 'lucide-react'

export type ConnectProvider = 'xaman' | 'riddle-wallet'

interface ConnectMenuProps {
  isConnecting?: boolean
  /** Compact style for header vs full for wallet section */
  variant?: 'header' | 'section'
  onConnectXaman: () => void
  onConnectRiddleWallet: () => void
  disabled?: boolean
}

/**
 * Connect dropdown: Riddle Wallet (deep link) + Xaman (payload SignIn).
 */
export default function ConnectMenu({
  isConnecting = false,
  variant = 'header',
  onConnectXaman,
  onConnectRiddleWallet,
  disabled = false,
}: ConnectMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const btnClass =
    variant === 'header'
      ? 'flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white shadow-lg shadow-blue-600/20'
      : 'flex items-center gap-2 bg-blue-600 hover:bg-blue-500 transition active:bg-blue-700 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white disabled:bg-zinc-800 disabled:text-zinc-400 shrink-0 shadow-lg shadow-blue-600/25'

  const label = isConnecting ? 'Opening…' : 'Connect Wallet'

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || isConnecting}
        className={btnClass}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Wallet size={17} />
        {label}
        <ChevronDown size={15} className={`opacity-80 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 z-50 w-[min(100vw-2rem,280px)] rounded-2xl border border-[#2a2e38] bg-[#111318] shadow-xl shadow-black/40 p-1.5"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[#1a1d26] transition"
            onClick={() => {
              setOpen(false)
              onConnectRiddleWallet()
            }}
          >
            <img
              src="/logos/wallet.jpg"
              alt=""
              className="w-8 h-8 rounded-lg object-cover ring-1 ring-white/10 shrink-0"
              width={32}
              height={32}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-100">Riddle Wallet</span>
              <span className="block text-[11px] text-slate-500 leading-snug">
                Preferential 0.5% fee · wallet.riddlewallet.com
              </span>
            </span>
            <ExternalLink size={14} className="text-slate-500 mt-1 shrink-0" />
          </button>

          <button
            type="button"
            role="menuitem"
            className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[#1a1d26] transition"
            onClick={() => {
              setOpen(false)
              onConnectXaman()
            }}
          >
            <span className="w-8 h-8 rounded-lg bg-[#1c2028] flex items-center justify-center shrink-0 ring-1 ring-white/10">
              <Wallet size={16} className="text-blue-400" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-100">Xaman</span>
              <span className="block text-[11px] text-slate-500 leading-snug">
                QR / deep link · XRPL SignIn
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
