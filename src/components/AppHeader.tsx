import { Wallet, X } from 'lucide-react'
import { shortAddr } from '../utils/format'

interface AppHeaderProps {
  address: string
  isConnecting?: boolean
  onConnect: () => void
  onDisconnect: () => void
}

export default function AppHeader({
  address,
  isConnecting = false,
  onConnect,
  onDisconnect,
}: AppHeaderProps) {
  return (
    <header className="border-b border-[#1f232c] bg-[#0a0c12]/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-[720px] mx-auto px-5 py-4 flex items-center justify-between gap-3">
        <a
          href="https://riddlewallet.com"
          className="flex items-center gap-3 no-underline text-inherit min-w-0"
        >
          <img
            src="/logo.jpg"
            alt="Riddle Swap"
            className="w-8 h-8 rounded-2xl object-cover ring-1 ring-white/10 shrink-0"
            width={32}
            height={32}
          />
          <div className="min-w-0">
            <div className="font-semibold text-[21px] tracking-[-0.6px]">Riddle Swap</div>
            <div className="text-[9px] text-slate-500 -mt-1 font-medium">
              XRPL DEX · XAMAN · SUITE
            </div>
          </div>
        </a>

        <div className="flex items-center gap-2 text-sm shrink-0">
          <a
            href="https://riddlewallet.com"
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#111318] hover:bg-[#16181f] text-xs text-slate-400"
          >
            Suite
          </a>
          {address ? (
            <>
              <span className="hidden xs:inline font-mono text-xs text-slate-400 px-2">
                {shortAddr(address)}
              </span>
              <button
                type="button"
                onClick={onDisconnect}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#1c2028] hover:bg-red-950/70 rounded-2xl text-xs font-medium"
              >
                <X size={15} /> Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onConnect}
              disabled={isConnecting}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 px-4 py-2.5 rounded-2xl text-sm font-semibold text-white shadow-lg shadow-blue-600/20"
            >
              <Wallet size={17} />
              {isConnecting ? 'Opening…' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
