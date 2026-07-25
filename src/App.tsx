import { useState, useEffect } from 'react'
import { Toaster } from 'sonner'

import {
  useTokens,
  useXrplClient,
  useBalances,
  useXummPayload,
  useAddTokenModal,
  useTokenPair,
  useWallet,
  useSwap,
  useLimitOrders,
} from './hooks'

import {
  AppHeader,
  TokenStrip,
  WalletSection,
  AddTokenModal,
  PayloadModal,
} from './components'
import { TradeCard, AppFooter } from './components/feature/swap'

/**
 * Thin orchestrator: wires swap hooks/state to presentational feature components.
 * Xaman is server-only via /api/xaman/payload — no client API keys.
 */
export default function XrplXummSwap() {
  const [activeTab, setActiveTab] = useState<'swap' | 'limit'>('swap')

  const { tokens, addCustomToken, searchTokens } = useTokens()
  const { getClient, disconnectClient } = useXrplClient()
  const { balances, isLoadingBalances, fetchBalances, setBalances } = useBalances({
    getClient,
    tokens,
  })
  const xumm = useXummPayload()

  const { fromToken, toToken, setFromToken, setToToken, selectFrom, selectTo, getBalance } =
    useTokenPair(balances)
  const { showAddToken, addTokenPrefill, openAddToken, closeAddToken, handleAddToken } =
    useAddTokenModal(addCustomToken)

  const xummWire = {
    createPayload: xumm.createPayload,
    openPayload: xumm.openPayload,
    pollPayload: xumm.pollPayload,
    resumePoll: xumm.resumePoll,
    resetPayload: xumm.resetPayload,
    setShowPayloadModal: xumm.setShowPayloadModal,
  }

  const { address, isConnecting, connectXaman, disconnect } = useWallet({
    ...xummWire,
    clearActivePoll: xumm.clearActivePoll,
    setPayloadStatus: xumm.setPayloadStatus,
    fetchBalances,
    activeUuid: xumm.activeUuid,
    checkOnce: xumm.checkOnce,
  })

  const swap = useSwap({
    address,
    fromToken,
    toToken,
    setFromToken,
    setToToken,
    getBalance,
    getClient,
    fetchBalances,
    ...xummWire,
  })

  const limit = useLimitOrders({
    address,
    fromToken,
    toToken,
    getBalance,
    getClient,
    fetchBalances,
    activeTab,
    ...xummWire,
  })

  useEffect(() => {
    if (address) {
      fetchBalances(address)
      limit.fetchOpenOrders(address)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address])

  useEffect(() => {
    return () => {
      disconnectClient()
      xumm.clearActivePoll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disconnectClient])

  const handleDisconnect = () => {
    disconnect()
    setBalances({})
    swap.clearSwapState()
    limit.clearLimitState()
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Toaster position="top-center" richColors closeButton />

      <AppHeader address={address} onDisconnect={handleDisconnect} />

      <div className="max-w-[720px] mx-auto px-5 pt-7 pb-8">
        <WalletSection
          address={address}
          isLoadingBalances={isLoadingBalances}
          onConnect={connectXaman}
          onRefresh={() => fetchBalances(address)}
          canConnect
          isConnecting={isConnecting}
          xamanReady={xumm.serverReady}
        />

        {xumm.serverReady === false && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Server Xaman is offline (missing XUMM_API_KEY / XUMM_API_SECRET). Connect and swaps
            will fail until keys are set on Vercel.
          </div>
        )}

        <TradeCard
          activeTab={activeTab}
          onTabChange={setActiveTab}
          fromToken={fromToken}
          toToken={toToken}
          tokens={tokens}
          address={address}
          getBalance={getBalance}
          onFromSelect={selectFrom}
          onToSelect={selectTo}
          onAddNewToken={openAddToken}
          onSearchTokens={searchTokens}
          payAmount={swap.payAmount}
          receiveAmount={swap.receiveAmount}
          quoteRate={swap.quoteRate}
          isQuoting={swap.isQuoting}
          isSwapping={swap.isSwapping}
          canSwap={swap.canSwap}
          slippage={swap.slippage}
          onPayAmountChange={swap.setPayAmount}
          onSwitch={swap.switchTokens}
          onFetchQuote={swap.fetchQuote}
          onSetSlippage={swap.setSlippage}
          onSetMax={swap.setMax}
          onExecuteSwap={swap.executeSwap}
          limitSellAmount={limit.limitSellAmount}
          limitPrice={limit.limitPrice}
          limitReceiveAmount={limit.limitReceiveAmount}
          limitExpiration={limit.limitExpiration}
          openOrders={limit.openOrders}
          isPlacingLimit={limit.isPlacingLimit}
          canPlaceLimit={limit.canPlaceLimit}
          onSellAmountChange={limit.setLimitSellAmount}
          onPriceChange={limit.setLimitPrice}
          onExpirationChange={limit.setLimitExpiration}
          onSetLimitMax={limit.setLimitMax}
          onUseMarketPrice={limit.useMarketPriceForLimit}
          onPlaceOrder={limit.placeLimitOrder}
          onRefreshOrders={() => limit.fetchOpenOrders(address)}
          onCancelOrder={limit.cancelOrder}
        />

        <TokenStrip
          tokens={tokens}
          onAddToken={() => openAddToken()}
          onPickToken={(t) => {
            if (activeTab === 'swap') {
              if (fromToken.currency === 'XRP' && t.currency !== 'XRP') setToToken(t)
              else setFromToken(t)
            }
          }}
        />

        <AddTokenModal
          open={showAddToken}
          onClose={closeAddToken}
          onAdd={handleAddToken}
          initialSearch={addTokenPrefill}
        />
      </div>

      <PayloadModal
        open={xumm.showPayloadModal}
        payload={xumm.currentPayload}
        status={xumm.payloadStatus}
        txHash={xumm.txHash}
        onClose={xumm.closePayloadModal}
      />

      <AppFooter />
    </div>
  )
}
