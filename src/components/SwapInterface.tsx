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
  /** Platform fee in basis points (50 = 0.5%). 0 = none. */
  feeBps?: number
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

function TokenRow({
  label,
  balance,
  symbol,
  amount,
  readOnly,
  onAmountChange,
  onMax,
  tokens,
  selected,
  onSelect,
  onAddNewToken,
  onSearchTokens,
  amountClassName,
}: {
  label: string
  balance: string
  symbol: string
  amount: string
  readOnly?: boolean
  onAmountChange?: (v: string) => void
  onMax?: () => void
  tokens: Token[]
  selected: Token
  onSelect: (t: Token) => void
  onAddNewToken: (prefill?: string) => void
  onSearchTokens?: (query: string) => Promise<Token[]>
  amountClassName?: string
}) {
  return (
    <div className="token-panel p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="uppercase tracking-[1.5px] text-[10px] font-semibold text-slate-500">
          {label}
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
          <span className="font-mono">{formatAmount(balance)}</span>
          <span className="text-slate-500">{symbol}</span>
          {onMax && (
            <button
              type="button"
              onClick={onMax}
              className="ml-1 px-2 py-px rounded bg-slate-800 text-blue-400 hover:bg-slate-700 active:bg-slate-900 text-[10px] font-bold"
            >
              MAX
            </button>
          )}
        </div>
      </div>
      {/* Amount + token selector stay inside this panel */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <input
          type={readOnly ? 'text' : 'number'}
          value={amount}
          readOnly={readOnly}
          onChange={onAmountChange ? (e) => onAmountChange(e.target.value) : undefined}
          className={`amount-input flex-1 min-w-0 bg-transparent text-3xl sm:text-4xl font-semibold outline-none placeholder:text-slate-700 tracking-tight ${amountClassName || ''}`}
          placeholder="0"
        />
        <div className="shrink-0 max-w-[48%] sm:max-w-none">
          <TokenDropdown
            tokens={tokens}
            selected={selected}
            onSelect={onSelect}
            onAddNew={onAddNewToken}
            onSearch={onSearchTokens}
          />
        </div>
      </div>
    </div>
  )
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
  feeBps = 0,
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
  const feePercent = feeBps > 0 ? (feeBps / 100).toFixed(feeBps % 100 === 0 ? 0 : 2) : null
  return (
    <div className="space-y-2 w-full">
      <TokenRow
        label="You pay"
        balance={fromBalance}
        symbol={fromToken.symbol}
        amount={payAmount}
        onAmountChange={onPayAmountChange}
        onMax={onSetMax}
        tokens={tokens}
        selected={fromToken}
        onSelect={onFromSelect}
        onAddNewToken={onAddNewToken}
        onSearchTokens={onSearchTokens}
      />

      <div className="flex justify-center -my-1 relative z-20">
        <button type="button" onClick={onSwitch} className="swap-arrow-btn" title="Switch tokens">
          <ArrowDownUp size={19} />
        </button>
      </div>

      <TokenRow
        label="You receive (est.)"
        balance={toBalance}
        symbol={toToken.symbol}
        amount={receiveAmount}
        readOnly
        tokens={tokens}
        selected={toToken}
        onSelect={onToSelect}
        onAddNewToken={onAddNewToken}
        onSearchTokens={onSearchTokens}
        amountClassName="text-emerald-400"
      />

      <div className="rate-bar flex items-center justify-between text-sm mt-1 mb-1 gap-2">
        {quoteRate ? (
          <div className="min-w-0 truncate">
            1 {fromToken.symbol} ≈{' '}
            <span className="font-semibold text-white">{quoteRate.split(' ')[0]}</span>{' '}
            {toToken.symbol}
          </div>
        ) : (
          <div className="text-slate-500 text-xs">Quote rate appears after refresh</div>
        )}
        <button
          type="button"
          onClick={onFetchQuote}
          disabled={isQuoting}
          className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-xl border border-[#2a2e38] hover:bg-[#16181f] disabled:opacity-60 active:bg-black shrink-0"
        >
          <RefreshCw size={14} className={isQuoting ? 'animate-spin' : ''} />
          {isQuoting ? '...' : 'Get quote'}
        </button>
      </div>

      <div className="flex items-center justify-between px-1 text-xs gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-slate-500">Slippage</span>
          {[0.5, 1, 2].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSetSlippage(s)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition ${
                slippage === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-[#2a2e38] hover:bg-[#16181f] text-slate-400'
              }`}
            >
              {s}%
            </button>
          ))}
        </div>
        <div className="text-[10px] text-slate-500 text-right">
          {feePercent != null ? (
            <span className="text-cyan-400/90">Platform fee {feePercent}%</span>
          ) : (
            'XRPL DEX'
          )}
        </div>
      </div>
    </div>
  )
}
