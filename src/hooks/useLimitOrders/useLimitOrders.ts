import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { isXRP } from '../../utils/xrpl'
import type { LimitExpiration, UseLimitOrdersParams } from '../useLimitOrders.types'
import { LIMIT_POLL_MAX_ATTEMPTS, LIMIT_POLL_INTERVAL_MS } from './constants'
import { fetchMarketRate, fetchAccountOffers } from './marketRate'
import { buildLimitOrderTx } from './buildLimitOrderTx'
import {
  clearPending,
  resolveResumeUuid,
  stripXamanQuery,
  xamanOptions,
} from '../../utils/xamanSession'

export type { LimitExpiration, UseLimitOrdersParams } from '../useLimitOrders.types'

export function useLimitOrders({
  address,
  apiKey,
  fromToken,
  toToken,
  getBalance,
  getClient,
  fetchBalances,
  onNeedApiKey,
  activeTab,
  createPayload,
  openPayload,
  pollPayload,
  resumePoll,
  resetPayload,
  setShowPayloadModal,
}: UseLimitOrdersParams) {
  const [limitSellAmount, setLimitSellAmount] = useState('100')
  const [limitPrice, setLimitPrice] = useState('0.25')
  const [limitReceiveAmount, setLimitReceiveAmount] = useState('')
  const [limitExpiration, setLimitExpiration] = useState<LimitExpiration>('never')
  const [isPlacingLimit, setIsPlacingLimit] = useState(false)
  const [openOrders, setOpenOrders] = useState<any[]>([])
  /** Sync lock for place + cancel (double-click / concurrent payload). */
  const limitInFlightRef = useRef(false)
  const resumedUuidRef = useRef<string | null>(null)

  const getCurrentMarketRate = useCallback(async (): Promise<number | null> => {
    return fetchMarketRate(getClient, fromToken, toToken)
  }, [fromToken, toToken, getClient])

  const fetchOpenOrders = useCallback(async (addr: string) => {
    if (!addr) return
    try {
      setOpenOrders(await fetchAccountOffers(getClient, addr))
    } catch (e: any) {
      console.error('Failed to load open orders', e)
      setOpenOrders([])
    }
  }, [getClient])

  useEffect(() => {
    const s = parseFloat(limitSellAmount)
    const p = parseFloat(limitPrice)
    if (!isNaN(s) && !isNaN(p) && p > 0) {
      setLimitReceiveAmount((s * p).toFixed(6))
    } else {
      setLimitReceiveAmount('')
    }
  }, [limitSellAmount, limitPrice])

  useEffect(() => {
    if (activeTab === 'limit' && (!limitPrice || parseFloat(limitPrice) === 0) && address) {
      getCurrentMarketRate().then((rate) => {
        if (rate && rate > 0) {
          setLimitPrice((rate * 1.002).toFixed(6))
        } else if (!limitPrice) {
          setLimitPrice('0.1')
        }
      })
    }
    // Only re-seed when tab changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const setLimitMax = useCallback(() => {
    const bal = parseFloat(getBalance(fromToken) || '0')
    if (bal > 0) {
      const max = isXRP(fromToken) ? Math.max(0, bal - 2) : bal
      setLimitSellAmount(max.toFixed(isXRP(fromToken) ? 2 : 4))
    }
  }, [fromToken, getBalance])

  const useMarketPriceForLimit = useCallback(async () => {
    const rate = await getCurrentMarketRate()
    if (rate && rate > 0) {
      const improved = (rate * 1.005).toFixed(6)
      setLimitPrice(improved)
      toast.info(`Using market price +0.5% ≈ ${improved}`)
    } else {
      toast.error('No market price available for this pair')
    }
  }, [getCurrentMarketRate])

  const unlockLimit = useCallback(() => {
    limitInFlightRef.current = false
    setIsPlacingLimit(false)
  }, [])

  // Resume OfferCreate / OfferCancel after return_url / reload
  useEffect(() => {
    if (!address || !apiKey.trim() || !resumePoll) return
    const uuid = resolveResumeUuid(['limit', 'cancel'])
    if (!uuid || resumedUuidRef.current === uuid) return
    resumedUuidRef.current = uuid

    limitInFlightRef.current = true
    setIsPlacingLimit(true)
    resumePoll(uuid, apiKey, {
      purpose: 'limit',
      maxAttempts: LIMIT_POLL_MAX_ATTEMPTS,
      intervalMs: LIMIT_POLL_INTERVAL_MS,
      onSigned: (status) => {
        clearPending()
        stripXamanQuery()
        setShowPayloadModal(true)
        if (status.response?.txid) {
          toast.success('Limit order signed! Tx: ' + status.response.txid.slice(0, 10))
        } else {
          toast.success('Signed in Xaman')
        }
        setTimeout(() => {
          if (address) {
            fetchBalances(address)
            fetchOpenOrders(address)
          }
        }, 6500)
        unlockLimit()
      },
      onRejected: (reason) => {
        clearPending()
        stripXamanQuery()
        toast.error(reason === 'expired' ? 'Request expired' : 'Order cancelled or timed out')
        unlockLimit()
      },
    })
  }, [address, apiKey, resumePoll, setShowPayloadModal, fetchBalances, fetchOpenOrders, unlockLimit])

  const placeLimitOrder = useCallback(async () => {
    // Guard against double-submit before React re-renders disabled button
    if (limitInFlightRef.current || isPlacingLimit) return
    if (!address) {
      toast.error('Connect Xaman first')
      return
    }
    if (!limitSellAmount || !limitReceiveAmount) {
      toast.error('Enter sell amount and price')
      return
    }
    if (fromToken.currency === toToken.currency && fromToken.issuer === toToken.issuer) {
      toast.error('Cannot create order for the same token')
      return
    }
    limitInFlightRef.current = true
    setIsPlacingLimit(true)
    resetPayload()

    try {
      const tx = buildLimitOrderTx({
        address,
        fromToken,
        toToken,
        limitSellAmount,
        limitReceiveAmount,
        limitExpiration,
      })
      const data = await createPayload(
        apiKey,
        {
          txjson: tx,
          options: xamanOptions({ expire: 10, submit: true }),
          custom_meta: {
            instruction: `Limit sell ${limitSellAmount} ${fromToken.currency} for ${toToken.currency}`,
          },
        },
        'Xumm error'
      )
      openPayload(data)
      resumedUuidRef.current = data.uuid

      // Keep lock until sign poll finishes
      pollPayload(data.uuid, apiKey, {
        purpose: 'limit',
        maxAttempts: LIMIT_POLL_MAX_ATTEMPTS,
        intervalMs: LIMIT_POLL_INTERVAL_MS,
        onSigned: (status) => {
          clearPending()
          stripXamanQuery()
          setShowPayloadModal(true)
          if (status.response?.txid) {
            toast.success('Limit order placed! Tx: ' + status.response.txid.slice(0, 10))
          }
          setTimeout(() => {
            if (address) {
              fetchBalances(address)
              fetchOpenOrders(address)
            }
          }, 6500)
          unlockLimit()
        },
        onRejected: (reason) => {
          clearPending()
          stripXamanQuery()
          toast.error(reason === 'expired' ? 'Request expired' : 'Order placement cancelled')
          unlockLimit()
        },
      })
    } catch (e: any) {
      toast.error('Failed to place order: ' + (e.message || e))
      unlockLimit()
    }
  }, [
    isPlacingLimit, address, limitSellAmount, limitReceiveAmount, limitExpiration,
    fromToken, toToken, apiKey, onNeedApiKey, resetPayload, createPayload, openPayload,
    pollPayload, fetchBalances, fetchOpenOrders, setShowPayloadModal, unlockLimit,
  ])

  const cancelOrder = useCallback(async (offerSequence: number) => {
    if (!address || !apiKey.trim()) {
      toast.error('Connect with API key first')
      return
    }
    // Prevent concurrent cancel payloads / polls
    if (limitInFlightRef.current || isPlacingLimit) return

    limitInFlightRef.current = true
    setIsPlacingLimit(true)
    resetPayload()

    try {
      const data = await createPayload(
        apiKey,
        {
          txjson: {
            TransactionType: 'OfferCancel',
            Account: address,
            OfferSequence: offerSequence,
          },
          options: xamanOptions({ submit: true, expire: 10 }),
          custom_meta: { instruction: `Cancel offer #${offerSequence}` },
        },
        'Xumm cancel failed'
      )
      openPayload(data)
      resumedUuidRef.current = data.uuid

      pollPayload(data.uuid, apiKey, {
        purpose: 'cancel',
        maxAttempts: LIMIT_POLL_MAX_ATTEMPTS,
        intervalMs: LIMIT_POLL_INTERVAL_MS,
        onSigned: () => {
          clearPending()
          stripXamanQuery()
          toast.success('Order cancelled')
          setTimeout(() => {
            if (address) fetchOpenOrders(address)
          }, 5000)
          unlockLimit()
        },
        onRejected: () => {
          clearPending()
          stripXamanQuery()
          toast.error('Cancel cancelled or timed out')
          unlockLimit()
        },
      })
    } catch (e: any) {
      toast.error('Cancel failed: ' + (e.message || e))
      unlockLimit()
    }
  }, [isPlacingLimit, address, apiKey, resetPayload, createPayload, openPayload, pollPayload, fetchOpenOrders, unlockLimit])

  const clearLimitState = useCallback(() => {
    setOpenOrders([])
    setLimitReceiveAmount('')
  }, [])

  const canPlaceLimit =
    !!address &&
    !!limitSellAmount &&
    !!limitReceiveAmount &&
    parseFloat(limitSellAmount) > 0 &&
    parseFloat(limitReceiveAmount) > 0

  return {
    limitSellAmount,
    setLimitSellAmount,
    limitPrice,
    setLimitPrice,
    limitReceiveAmount,
    limitExpiration,
    setLimitExpiration,
    isPlacingLimit,
    openOrders,
    canPlaceLimit,
    setLimitMax,
    useMarketPriceForLimit,
    placeLimitOrder,
    cancelOrder,
    fetchOpenOrders,
    clearLimitState,
  }
}
