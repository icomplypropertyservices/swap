import { RefreshCw, Wallet } from 'lucide-react'
import { shortAddr } from '../utils/format'

interface WalletSectionProps {
  address: string
  isLoadingBalances: boolean
  onConnect: () => void
  onRefresh: () => void
  /** Always allow connect — server Xaman proxy or optional personal key */
  canConnect?: boolean
  isConnecting: boolean
  xamanReady?: boolean | null
}

export default function WalletSection({
  address,
  isLoadingBalances,
  onConnect,
  onRefresh,
  canConnect = true,
  isConnecting,
  xamanReady,
}: WalletSectionProps) {
  return (
    <div className="mb-6 flex items-center justify-between px-1 gap-3 flex-wrap">
      <div className="min-w-0">
        <div className="text-[10px] text-blue-400 tracking-[1px] font-semibold mb-px">
          WALLET
        </div>
        {address ? (
          <div className="font-mono text-xl flex items-center gap-3 tracking-tight">
            {shortAddr(address)}
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
            Connect with Xaman to swap
            {xamanReady === false && (
              <span className="block text-[11px] text-amber-400/90 mt-0.5">
                Server Xaman not ready — check Vercel env
              </span>
            )}
          </div>
        )}
      </div>

      {!address ? (
        <button
          type="button"
          onClick={onConnect}
          disabled={isConnecting || canConnect === false}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 transition active:bg-blue-700 px-5 py-2.5 rounded-2xl text-sm font-semibold text-white disabled:bg-zinc-800 disabled:text-zinc-400 shrink-0 shadow-lg shadow-blue-600/25"
        >
          <Wallet size={17} /> {isConnecting ? 'Opening Xaman…' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="uppercase tracking-[1px] text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          Connected
        </div>
      )}
    </div>
  )
}
