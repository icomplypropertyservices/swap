import type { Token } from '../types'
import TokenDropdown from './TokenDropdown'
import { formatAmount } from '../utils/format'
import OpenOrdersList from './feature/swap/OpenOrdersList'

interface LimitInterfaceProps {
  limitSellAmount: string
  limitPrice: string
  limitReceiveAmount: string
  limitExpiration: 'never' | '1h' | '1d' | '7d'
  fromToken: Token
  toToken: Token
  fromBalance: string
  openOrders: any[]
  tokens: Token[]
  address: string
  isPlacingLimit: boolean
  canPlaceLimit: boolean
  onSellAmountChange: (val: string) => void
  onPriceChange: (val: string) => void
  onExpirationChange: (val: 'never' | '1h' | '1d' | '7d') => void
  onFromSelect: (t: Token) => void
  onToSelect: (t: Token) => void
  onSetMax: () => void
  onUseMarketPrice: () => void
  onPlaceOrder: () => void
  onAddNewToken: (prefill?: string) => void
  onRefreshOrders: () => void
  onCancelOrder: (seq: number) => void
  onSearchTokens?: (query: string) => Promise<Token[]>
}

export default function LimitInterface({
  limitSellAmount,
  limitPrice,
  limitReceiveAmount,
  limitExpiration,
  fromToken,
  toToken,
  fromBalance,
  openOrders,
  tokens,
  address,
  isPlacingLimit,
  canPlaceLimit,
  onSellAmountChange,
  onPriceChange,
  onExpirationChange,
  onFromSelect,
  onToSelect,
  onSetMax,
  onUseMarketPrice,
  onPlaceOrder,
  onAddNewToken,
  onRefreshOrders,
  onCancelOrder,
  onSearchTokens,
}: LimitInterfaceProps) {
  return (
    <div className="space-y-5">
      <div className="text-xs uppercase tracking-widest text-amber-400/70 px-0.5">
        Place order on the XRPL orderbook
      </div>

      <div>
        <div className="text-[11px] font-semibold tracking-widest text-slate-400 mb-1.5 px-1">SELL</div>
        <div className="token-panel flex items-center p-4 gap-3">
          <input
            value={limitSellAmount}
            onChange={(e) => onSellAmountChange(e.target.value)}
            type="number"
            className="limit-input flex-1"
            placeholder="0.0"
          />
          <TokenDropdown
            tokens={tokens}
            selected={fromToken}
            onSelect={onFromSelect}
            onAddNew={onAddNewToken}
            onSearch={onSearchTokens}
          />
        </div>
        <div className="text-right mt-1 text-xs text-slate-500 pr-1">
          Balance: {formatAmount(fromBalance)}{' '}
          <button type="button" onClick={onSetMax} className="text-blue-400 ml-1">
            MAX
          </button>
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold tracking-widest text-slate-400 mb-1.5 px-1">
          LIMIT PRICE (per 1 {fromToken.symbol})
        </div>
        <div className="token-panel flex items-center p-4 gap-3">
          <input
            value={limitPrice}
            onChange={(e) => onPriceChange(e.target.value)}
            type="number"
            className="limit-input flex-1"
            placeholder="0"
          />
          <div className="text-slate-400 font-medium pr-2">{toToken.symbol}</div>
          <TokenDropdown
            tokens={tokens}
            selected={toToken}
            onSelect={onToSelect}
            onAddNew={onAddNewToken}
            onSearch={onSearchTokens}
          />
        </div>
        <button
          type="button"
          onClick={onUseMarketPrice}
          className="text-blue-400 hover:text-blue-300 text-xs mt-1.5 px-1"
        >
          Use current market +0.5%
        </button>
      </div>

      <div>
        <div className="text-[11px] font-semibold tracking-widest text-slate-400 mb-1.5 px-1">
          YOU WILL RECEIVE AT LEAST
        </div>
        <div className="token-panel px-5 py-4 text-4xl font-semibold text-emerald-400 tracking-tight">
          {limitReceiveAmount || '0.00'}{' '}
          <span className="text-xl text-emerald-400/60 align-baseline">{toToken.symbol}</span>
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold tracking-widest text-slate-400 mb-1.5 px-1">EXPIRES</div>
        <div className="flex gap-2">
          {(['never', '1h', '1d', '7d'] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => onExpirationChange(o)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-2xl border transition ${
                limitExpiration === o
                  ? 'bg-amber-500 text-black border-amber-500'
                  : 'border-[#2a2e38] hover:bg-[#16181f] text-slate-300'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onPlaceOrder}
        disabled={!canPlaceLimit || isPlacingLimit}
        className="w-full py-4 text-base font-semibold rounded-2xl bg-gradient-to-b from-amber-400 to-yellow-500 text-black active:scale-[0.985] disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-400 transition"
      >
        {isPlacingLimit ? 'Opening Xaman...' : 'Place Limit Order'}
      </button>

      {address && (
        <OpenOrdersList
          orders={openOrders}
          onRefresh={onRefreshOrders}
          onCancel={onCancelOrder}
          disabled={isPlacingLimit}
        />
      )}
    </div>
  )
}
