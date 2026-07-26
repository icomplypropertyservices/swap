import { X } from 'lucide-react'
import { shortAddr } from '../utils/format'
import ConnectMenu from './ConnectMenu'

interface AppHeaderProps {
  address: string
  isConnecting?: boolean
  /** Shown when connected via Riddle Wallet session */
  walletLabel?: string | null
  /** Platform fee label e.g. "0.5" or null to hide */
  feePercent?: string | null
  onConnectXaman: () => void
  onConnectRiddleWallet: () => void
  onDisconnect: () => void
}

export default function AppHeader({
  address,
  isConnecting = false,
  walletLabel,
  feePercent,
  onConnectXaman,
  onConnectRiddleWallet,
  onDisconnect,
}: AppHeaderProps) {
  return (
    <header className="border-b border-[#1f232c] bg-[#0a0c12]/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-[720px] xl:max-w-[980px] mx-auto px-5 py-4 flex items-center justify-between gap-3">
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
              {feePercent != null && feePercent !== '' && (
                <span className="text-slate-600"> · {feePercent}% fee</span>
              )}
            </div>
          </div>
        </a>

        <div className="flex items-center gap-2 text-sm shrink-0">
          <a
            href="https://wallet.riddlewallet.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#111318] hover:bg-[#16181f] text-xs text-slate-400"
            title="Open Riddle Wallet"
          >
            Wallet
          </a>
          <a
            href="https://riddlewallet.com"
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#111318] hover:bg-[#16181f] text-xs text-slate-400"
          >
            Suite
          </a>
          {address ? (
            <>
              <span className="hidden xs:inline font-mono text-xs text-slate-400 px-2">
                {walletLabel ? `${walletLabel} · ` : ''}
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
            <ConnectMenu
              variant="header"
              isConnecting={isConnecting}
              onConnectXaman={onConnectXaman}
              onConnectRiddleWallet={onConnectRiddleWallet}
            />
          )}
        </div>
      </div>
    </header>
  )
}
