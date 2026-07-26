import { RefreshCw } from 'lucide-react'
import { shortAddr } from '../utils/format'
import ConnectMenu from './ConnectMenu'

interface WalletSectionProps {
  address: string
  isLoadingBalances: boolean
  onConnectXaman: () => void
  onConnectRiddleWallet: () => void
  onRefresh: () => void
  /** Always allow connect — server Xaman proxy or optional personal key */
  canConnect?: boolean
  isConnecting: boolean
  xamanReady?: boolean | null
  /** e.g. "Riddle Wallet" when session active */
  walletLabel?: string | null
  feePercent?: string | null
}

export default function WalletSection({
  address,
  isLoadingBalances,
  onConnectXaman,
  onConnectRiddleWallet,
  onRefresh,
  canConnect = true,
  isConnecting,
  xamanReady,
  walletLabel,
  feePercent,
}: WalletSectionProps) {
  return (
    <div className="mb-6 flex items-center justify-between px-1 gap-3 flex-wrap">
      <div className="min-w-0">
        <div className="text-[10px] text-blue-400 tracking-[1px] font-semibold mb-px">
          WALLET
        </div>
        {address ? (
          <div className="font-mono text-xl flex items-center gap-3 tracking-tight flex-wrap">
            {shortAddr(address)}
            {walletLabel && (
              <span className="text-[10px] font-sans uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/25">
                {walletLabel}
              </span>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoadingBalances}
              className="text-blue-400 active:text-blue-500"
              title="Refresh balances"
            >
              <RefreshCw size={15} className={isLoadingBalances ? 'animate-spin' : ''} />
            </button>
          </div>
        ) : (
          <div className="text-slate-400 text-sm sm:text-base">
            Connect with Riddle Wallet or Xaman to swap
            {feePercent != null && feePercent !== '' && Number(feePercent) > 0 && (
              <span className="block text-[11px] text-cyan-400/90 mt-0.5">
                Riddle Wallet session → {feePercent}% platform fee
              </span>
            )}
            {xamanReady === false && (
              <span className="block text-[11px] text-amber-400/90 mt-0.5">
                Server Xaman not ready — check Vercel env
              </span>
            )}
          </div>
        )}
      </div>

      {!address ? (
        <ConnectMenu
          variant="section"
          isConnecting={isConnecting}
          disabled={canConnect === false}
          onConnectXaman={onConnectXaman}
          onConnectRiddleWallet={onConnectRiddleWallet}
        />
      ) : (
        <div className="uppercase tracking-[1px] text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          Connected
        </div>
      )}
    </div>
  )
}
