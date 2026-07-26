import { useState, useEffect, useMemo, useRef } from 'react'
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
  AdSlot,
} from './components'
import { TradeCard, AppFooter } from './components/feature/swap'
import {
  getSuiteFeeBps,
  hasRiddleWalletSession,
  RIDDLE_WALLET_FEE_BPS,
} from './lib/riddleWallet'
import { hasSwapDeeplink, resolveSwapDeeplink } from './utils'

/** Existing (non–Riddle Wallet) platform fee bps — default 0 keeps prior no-fee behavior. */
function existingPlatformFeeBps(): number {
  try {
    const raw =
      (import.meta as ImportMeta & { env?: Record<string, string> }).env
        ?.VITE_PLATFORM_FEE_BPS ??
      (import.meta as ImportMeta & { env?: Record<string, string> }).env
        ?.NEXT_PUBLIC_PLATFORM_FEE_BPS
    if (raw == null || raw === '') return 0
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

/**
 * Thin orchestrator: wires swap hooks/state to presentational feature components.
 * Xaman is server-only via /api/xaman/payload — no client API keys.
 * Riddle Wallet connect → deep link wallet.riddlewallet.com + 0.5% fee session.
 */
export default function XrplXummSwap() {
  const [activeTab, setActiveTab] = useState<'swap' | 'limit'>('swap')
  /** Re-read fee when session may change (connect/disconnect). */
  const [feeTick, setFeeTick] = useState(0)

  const feeBps = useMemo(() => {
    void feeTick
    return getSuiteFeeBps(existingPlatformFeeBps())
  }, [feeTick])

  const feePercent =
    feeBps > 0 ? (feeBps / 100).toFixed(feeBps % 100 === 0 ? 0 : 2) : null

  const { tokens, addCustomToken, searchTokens, isLoadingTokens } = useTokens()
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

  const {
    address,
    isConnecting,
    walletProvider,
    connectXaman,
    connectRiddleWallet,
    disconnect,
  } = useWallet({
    ...xummWire,
    clearActivePoll: xumm.clearActivePoll,
    setPayloadStatus: xumm.setPayloadStatus,
    fetchBalances,
    activeUuid: xumm.activeUuid,
    checkOnce: xumm.checkOnce,
  })

  // Refresh fee when address / provider changes
  useEffect(() => {
    setFeeTick((t) => t + 1)
  }, [address, walletProvider])

  // Storage event from other tabs (session written)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'riddle_wallet_session' || e.key === null) {
        setFeeTick((t) => t + 1)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const swap = useSwap({
    address,
    fromToken,
    toToken,
    setFromToken,
    setToToken,
    getBalance,
    getClient,
    fetchBalances,
    feeBps,
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

  // Suite deep-link: ?from=&to=&amount=&chain= → trade form (does not touch ?xaman)
  // Production query prefill for openSwapSuite / external openers.
  const deeplinkAppliedRef = useRef(false)
  useEffect(() => {
    if (deeplinkAppliedRef.current) return
    if (typeof window === 'undefined') return
    if (!hasSwapDeeplink()) return

    // Amount/chain-only can apply immediately; from/to wait for catalog so
    // symbol-only refs (SOLO, USD) resolve to real issuers when possible.
    const early = resolveSwapDeeplink(window.location.href, tokens)
    const needsCatalog = !!(early.raw.from || early.raw.to) && early.isXrplChain
    if (needsCatalog && isLoadingTokens) return

    const resolved = needsCatalog
      ? resolveSwapDeeplink(window.location.href, tokens)
      : early
    if (!resolved.hasTradePrefill) {
      deeplinkAppliedRef.current = true
      return
    }

    let applied = false
    if (resolved.fromToken) {
      setFromToken(resolved.fromToken)
      applied = true
    }
    if (resolved.toToken) {
      setToToken(resolved.toToken)
      applied = true
    }
    if (resolved.amount) {
      swap.setPayAmount(resolved.amount)
      limit.setLimitSellAmount(resolved.amount)
      applied = true
    }

    // Mark done when we applied something, or when only non-actionable params remain
    // (e.g. foreign chain) so we do not re-run every catalog merge.
    if (applied || resolved.raw.chain || !resolved.isXrplChain) {
      deeplinkAppliedRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, isLoadingTokens])

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
    setFeeTick((t) => t + 1)
  }

  const walletLabel =
    walletProvider === 'riddle-wallet' || hasRiddleWalletSession()
      ? 'Riddle Wallet'
      : walletProvider === 'xaman'
        ? 'Xaman'
        : null

  /** Primary CTA when disconnected — prefer Riddle Wallet deep link, else open Xaman. */
  const onConnectPrimary = () => {
    connectRiddleWallet()
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Toaster position="top-center" richColors closeButton />

      <AppHeader
        address={address}
        isConnecting={isConnecting}
        walletLabel={walletLabel}
        feePercent={feePercent}
        onConnectXaman={connectXaman}
        onConnectRiddleWallet={connectRiddleWallet}
        onDisconnect={handleDisconnect}
      />

      <div className="max-w-[720px] xl:max-w-[980px] mx-auto px-5 pt-7 pb-8">
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_220px] xl:gap-5 xl:items-start">
          <div className="min-w-0">
            {/* Sponsored banner above main swap UI — isolated from Xaman/swap state */}
            <AdSlot slot="swap.banner" variant="banner" />

            <WalletSection
              address={address}
              isLoadingBalances={isLoadingBalances}
              onConnectXaman={connectXaman}
              onConnectRiddleWallet={connectRiddleWallet}
              onRefresh={() => fetchBalances(address)}
              canConnect
              isConnecting={isConnecting}
              xamanReady={xumm.serverReady}
              walletLabel={walletLabel}
              feePercent={
                hasRiddleWalletSession()
                  ? (RIDDLE_WALLET_FEE_BPS / 100).toFixed(1)
                  : feePercent
              }
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
              feeBps={feeBps}
              onPayAmountChange={swap.setPayAmount}
              onSwitch={swap.switchTokens}
              onFetchQuote={swap.fetchQuote}
              onSetSlippage={swap.setSlippage}
              onSetMax={swap.setMax}
              onExecuteSwap={swap.executeSwap}
              onConnect={onConnectPrimary}
              isConnecting={isConnecting}
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

          {/* Desktop-only sponsored sidebar — does not affect mobile swap flow */}
          <div className="hidden xl:block sticky top-24">
            <AdSlot slot="swap.sidebar" variant="sidebar" />
          </div>
        </div>
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
