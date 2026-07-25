import { ArrowDownUp, RefreshCw } from 'lucide-react'
import type { Token } from '../types'
import TokenDropdown from './TokenDropdown'
import { formatAmount } from '../utils/format'

interface SwapInterfaceProps {
  payAmount: string
  receiveAmount: string
  fromToken: Token
  toToken: Token
  fromBalance: string
  toBalance: string
  quoteRate: string
  isQuoting: boolean
  slippage: number
  tokens: Token[]
  onPayAmountChange: (val: string) => void
  onFromSelect: (t: Token) => void
  onToSelect: (t: Token) => void
  onSwitch: () => void
  onFetchQuote: () => void
  onSetSlippage: (val: number) => void
  onSetMax: () => void
  onAddNewToken: (prefill?: string) => void
  onSearchTokens?: (query: string) => Promise<Token[]>
}

export default function SwapInterface({
  payAmount,
  receiveAmount,
  fromToken,
  toToken,
  fromBalance,
  toBalance,
  quoteRate,
  isQuoting,
  slippage,
  tokens,
  onPayAmountChange,
  onFromSelect,
  onToSelect,
  onSwitch,
  onFetchQuote,
  onSetSlippage,
  onSetMax,
  onAddNewToken,
  onSearchTokens,
}: SwapInterfaceProps) {
  return (
    <div className="space-y-2">
      {/* FROM PANEL */}
      <div className="token-panel p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="uppercase tracking-[1.5px] text-[10px] font-semibold text-slate-500">You pay</div>
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <span className="font-mono">{formatAmount(fromBalance)}</span>
            <span className="text-slate-500">{fromToken.symbol}</span>
            <button onClick={onSetMax} className="ml-1 px-2 py-px rounded bg-slate-800 text-blue-400 hover:bg-slate-700 active:bg-slate-900 text-[10px] font-bold">MAX</button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={payAmount}
            onChange={e => onPayAmountChange(e.target.value)}
            className="amount-input flex-1 bg-transparent text-5xl font-semibold outline-none placeholder:text-slate-700 tracking-[-2.5px]"
            placeholder="0"
          />
          <TokenDropdown
            tokens={tokens}
            selected={fromToken}
            onSelect={onFromSelect}
            onAddNew={onAddNewToken}
            onSearch={onSearchTokens}
          />
        </div>
      </div>

      {/* Beautiful center flip */}
      <div className="flex justify-center -my-1 relative z-10">
        <button type="button" onClick={onSwitch} className="swap-arrow-btn" title="Switch tokens">
          <ArrowDownUp size={19} />
        </button>
      </div>

      {/* TO PANEL */}
      <div className="token-panel p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="uppercase tracking-[1.5px] text-[10px] font-semibold text-slate-500">You receive (est.)</div>
          <div className="text-xs text-slate-400">
            <span className="font-mono">{formatAmount(toBalance)}</span> {toToken.symbol}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={receiveAmount}
            readOnly
            className="amount-input flex-1 bg-transparent text-5xl font-semibold outline-none text-emerald-400 tracking-[-2.5px] placeholder:text-slate-700"
            placeholder="0"
          />
          <TokenDropdown
            tokens={tokens}
            selected={toToken}
            onSelect={onToSelect}
            onAddNew={onAddNewToken}
            onSearch={onSearchTokens}
          />
        </div>
      </div>

      {/* Rate + refresh bar */}
      <div className="rate-bar flex items-center justify-between text-sm mt-1 mb-1">
        {quoteRate ? (
          <div>
            1 {fromToken.symbol} ≈ <span className="font-semibold text-white">{quoteRate.split(' ')[0]}</span> {toToken.symbol}
          </div>
        ) : (
          <div className="text-slate-500 text-xs">Quote rate appears after refresh</div>
        )}
        <button
          onClick={onFetchQuote}
          disabled={isQuoting}
          className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-xl border border-[#2a2e38] hover:bg-[#16181f] disabled:opacity-60 active:bg-black"
        >
          <RefreshCw size={14} className={isQuoting ? 'animate-spin' : ''} />
          {isQuoting ? '...' : 'Get quote'}
        </button>
      </div>

      {/* Slippage + info row */}
      <div className="flex items-center justify-between px-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500">Slippage</span>
          {[0.5, 1, 2].map(s => (
            <button
              key={s}
              onClick={() => onSetSlippage(s)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition ${slippage === s ? 'bg-blue-600 text-white border-blue-600' : 'border-[#2a2e38] hover:bg-[#16181f] text-slate-400'}`}
            >
              {s}%
            </button>
          ))}
        </div>
        <div className="text-[10px] text-slate-500">XRPL DEX</div>
      </div>
    </div>
  )
}
