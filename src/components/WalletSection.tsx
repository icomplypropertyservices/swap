import { RefreshCw, Wallet } from 'lucide-react'
import { shortAddr } from '../utils/format'

interface WalletSectionProps {
  address: string
  isLoadingBalances: boolean
  onConnect: () => void
  onRefresh: () => void
  canConnect: boolean
  isConnecting: boolean
}

export default function WalletSection({
  address,
  isLoadingBalances,
  onConnect,
  onRefresh,
  canConnect,
  isConnecting,
}: WalletSectionProps) {
  return (
    <div className="mb-6 flex items-center justify-between px-1">
      <div>
        <div className="text-[10px] text-blue-400 tracking-[1px] font-semibold mb-px">CONNECTED WALLET</div>
        {address ? (
          <div className="font-mono text-xl flex items-center gap-3 tracking-tight">
            {shortAddr(address)}
            <button onClick={onRefresh} disabled={isLoadingBalances} className="text-blue-400 active:text-blue-500">
              <RefreshCw size={15} className={isLoadingBalances ? 'animate-spin' : ''} />
            </button>
          </div>
        ) : (
          <div className="text-slate-400 text-lg">Not connected</div>
        )}
      </div>

      {!address ? (
        <button
          onClick={onConnect}
          disabled={isConnecting || !canConnect}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 transition active:bg-blue-700 px-5 py-2.5 rounded-2xl text-sm font-semibold disabled:bg-zinc-800 disabled:text-zinc-400"
        >
          <Wallet size={17} /> {isConnecting ? 'OPENING XAMAN' : 'CONNECT XAMAN'}
        </button>
      ) : (
        <div className="uppercase tracking-[1px] text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          CONNECTED
        </div>
      )}
    </div>
  )
}
