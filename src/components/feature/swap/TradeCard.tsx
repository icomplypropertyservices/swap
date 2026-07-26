import type { Token } from '../../../types'
import SwapInterface from '../../SwapInterface'
import LimitInterface from '../../LimitInterface'

export interface TradeCardProps {
  activeTab: 'swap' | 'limit'
  onTabChange: (tab: 'swap' | 'limit') => void
  // Shared token pair
  fromToken: Token
  toToken: Token
  tokens: Token[]
  address: string
  getBalance: (token: Token) => string
  onFromSelect: (t: Token) => void
  onToSelect: (t: Token) => void
  onAddNewToken: (prefill?: string) => void
  onSearchTokens: (query: string) => Promise<Token[]>
  // Swap
  payAmount: string
  receiveAmount: string
  quoteRate: string
  isQuoting: boolean
  isSwapping: boolean
  canSwap: boolean
  slippage: number
  onPayAmountChange: (val: string) => void
  onSwitch: () => void
  onFetchQuote: () => void
  onSetSlippage: (val: number) => void
  onSetMax: () => void
  onExecuteSwap: () => void
  /** Platform fee in basis points (50 = 0.5%) */
  feeBps?: number
  /** When disconnected, primary CTA connects wallet instead of swapping */
  onConnect: () => void
  isConnecting?: boolean
  // Limit
  limitSellAmount: string
  limitPrice: string
  limitReceiveAmount: string
  limitExpiration: 'never' | '1h' | '1d' | '7d'
  openOrders: any[]
  isPlacingLimit: boolean
  canPlaceLimit: boolean
  onSellAmountChange: (val: string) => void
  onPriceChange: (val: string) => void
  onExpirationChange: (val: 'never' | '1h' | '1d' | '7d') => void
  onSetLimitMax: () => void
  onUseMarketPrice: () => void
  onPlaceOrder: () => void
  onRefreshOrders: () => void
  onCancelOrder: (seq: number) => void
}

/**
 * Main swap/limit card: tab switcher + active interface + swap CTA.
 */
export default function TradeCard({
  activeTab,
  onTabChange,
  fromToken,
  toToken,
  tokens,
  address,
  getBalance,
  onFromSelect,
  onToSelect,
  onAddNewToken,
  onSearchTokens,
  payAmount,
  receiveAmount,
  quoteRate,
  isQuoting,
  isSwapping,
  canSwap,
  slippage,
  onPayAmountChange,
  onSwitch,
  onFetchQuote,
  onSetSlippage,
  onSetMax,
  onExecuteSwap,
  feeBps = 0,
  onConnect,
  isConnecting = false,
  limitSellAmount,
  limitPrice,
  limitReceiveAmount,
  limitExpiration,
  openOrders,
  isPlacingLimit,
  canPlaceLimit,
  onSellAmountChange,
  onPriceChange,
  onExpirationChange,
  onSetLimitMax,
  onUseMarketPrice,
  onPlaceOrder,
  onRefreshOrders,
  onCancelOrder,
}: TradeCardProps) {
  const connected = Boolean(address)

  return (
    <div className="swap-card w-full max-w-[480px] mx-auto p-4 sm:p-6 overflow-visible">
      <div className="flex mb-5 sm:mb-6 bg-[#0a0c12] rounded-2xl p-1 text-sm font-semibold border border-[#23262f]">
        <button
          onClick={() => onTabChange('swap')}
          className={`tab-btn ${activeTab === 'swap' ? 'active' : ''}`}
        >
          Swap
        </button>
        <button
          onClick={() => onTabChange('limit')}
          className={`tab-btn ${activeTab === 'limit' ? 'active' : ''}`}
        >
          Limit Order
        </button>
      </div>

      {activeTab === 'swap' && (
        <>
          <SwapInterface
            payAmount={payAmount}
            receiveAmount={receiveAmount}
            fromToken={fromToken}
            toToken={toToken}
            fromBalance={getBalance(fromToken)}
            toBalance={getBalance(toToken)}
            quoteRate={quoteRate}
            isQuoting={isQuoting}
            slippage={slippage}
            tokens={tokens}
            onPayAmountChange={onPayAmountChange}
            onFromSelect={onFromSelect}
            onToSelect={onToSelect}
            onSwitch={onSwitch}
            onFetchQuote={onFetchQuote}
            onSetSlippage={onSetSlippage}
            onSetMax={onSetMax}
            onAddNewToken={onAddNewToken}
            onSearchTokens={onSearchTokens}
            feeBps={feeBps}
          />
          <button
            type="button"
            onClick={() => {
              if (!connected) onConnect()
              else onExecuteSwap()
            }}
            disabled={
              connected
                ? !canSwap || isSwapping
                : isConnecting
            }
            className="primary-btn w-full mt-4 py-[17px] text-[17px] flex items-center justify-center gap-2 disabled:cursor-not-allowed"
          >
            {isConnecting
              ? 'Opening…'
              : isSwapping
                ? 'Waiting for signature…'
                : !connected
                  ? 'Connect Wallet to Swap'
                  : 'Swap via XRPL'}
          </button>
          <div className="text-center text-[10px] text-slate-600 pt-1">
            Market swap uses Payment • XRPL DEX
            {feeBps > 0 ? ` • ${(feeBps / 100).toFixed(feeBps % 100 === 0 ? 0 : 2)}% platform fee` : ''}
          </div>
        </>
      )}

      {activeTab === 'limit' && (
        <LimitInterface
          limitSellAmount={limitSellAmount}
          limitPrice={limitPrice}
          limitReceiveAmount={limitReceiveAmount}
          limitExpiration={limitExpiration}
          fromToken={fromToken}
          toToken={toToken}
          fromBalance={getBalance(fromToken)}
          openOrders={openOrders}
          tokens={tokens}
          address={address}
          isPlacingLimit={isPlacingLimit}
          canPlaceLimit={canPlaceLimit}
          onSellAmountChange={onSellAmountChange}
          onPriceChange={onPriceChange}
          onExpirationChange={onExpirationChange}
          onFromSelect={onFromSelect}
          onToSelect={onToSelect}
          onSetMax={onSetLimitMax}
          onUseMarketPrice={onUseMarketPrice}
          onPlaceOrder={onPlaceOrder}
          onAddNewToken={onAddNewToken}
          onRefreshOrders={onRefreshOrders}
          onCancelOrder={onCancelOrder}
          onSearchTokens={onSearchTokens}
        />
      )}
    </div>
  )
}
