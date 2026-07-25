import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { isXRP } from '../../utils/xrpl'
import type { UseSwapParams } from './types'
import { SWAP_POLL_MAX_ATTEMPTS, SWAP_POLL_INTERVAL_MS } from './constants'
import { fetchDexQuote } from './fetchQuote'
import { buildSwapTx } from './buildSwapTx'
import {
  clearPending,
  resolveResumeUuid,
  stripXamanQuery,
  xamanOptions,
} from '../../utils/xamanSession'

export type { UseSwapParams } from './types'

export function useSwap({
  address,
  fromToken,
  toToken,
  setFromToken,
  setToToken,
  getBalance,
  getClient,
  fetchBalances,
  createPayload,
  openPayload,
  pollPayload,
  resumePoll,
  resetPayload,
  setShowPayloadModal,
}: UseSwapParams) {
  const [payAmount, setPayAmount] = useState('10')
  const [receiveAmount, setReceiveAmount] = useState('')
  const [quoteRate, setQuoteRate] = useState('')
  const [slippage, setSlippage] = useState(1)
  const [isQuoting, setIsQuoting] = useState(false)
  const [isSwapping, setIsSwapping] = useState(false)
  /** Sync lock — React state alone can miss double-clicks before re-render. */
  const swapInFlightRef = useRef(false)
  const resumedUuidRef = useRef<string | null>(null)

  const switchTokens = useCallback(() => {
    const oldFrom = fromToken
    const oldTo = toToken
    setFromToken(oldTo)
    setToToken(oldFrom)
    if (receiveAmount && payAmount) {
      setPayAmount(receiveAmount)
      setReceiveAmount(payAmount)
    }
    setQuoteRate('')
  }, [fromToken, toToken, receiveAmount, payAmount, setFromToken, setToToken])

  const fetchQuote = useCallback(async () => {
    if (!payAmount || parseFloat(payAmount) <= 0) {
      setReceiveAmount('')
      setQuoteRate('')
      return
    }
    setIsQuoting(true)

    try {
      const result = await fetchDexQuote(getClient, fromToken, toToken, payAmount, slippage)
      setReceiveAmount(result.receiveAmount)
      setQuoteRate(result.quoteRate)
    } catch (e: any) {
      console.error(e)
      setReceiveAmount('')
      setQuoteRate('')
    } finally {
      setIsQuoting(false)
    }
  }, [payAmount, fromToken, toToken, slippage, getClient])

  // Debounced quote refresh — skip ticks while tab is hidden to avoid background DEX spam
  useEffect(() => {
    if (!address || !payAmount) return

    let t: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      if (t) clearTimeout(t)
      if (typeof document !== 'undefined' && document.hidden) return
      t = setTimeout(() => {
        if (typeof document !== 'undefined' && document.hidden) return
        fetchQuote()
      }, 420)
    }

    schedule()

    const onVis = () => {
      if (!document.hidden) schedule()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      if (t) clearTimeout(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [payAmount, fromToken, toToken, slippage, address, fetchQuote])

  const setMax = useCallback(() => {
    const bal = parseFloat(getBalance(fromToken) || '0')
    if (bal > 0) {
      const max = isXRP(fromToken) ? Math.max(0, bal - 1) : bal
      setPayAmount(max.toFixed(isXRP(fromToken) ? 2 : 4))
    }
  }, [fromToken, getBalance])

  const onSwapSigned = useCallback(
    (status: { response?: { txid?: string } }) => {
      clearPending()
      stripXamanQuery()
      setShowPayloadModal(true)
      if (status.response?.txid) {
        toast.success('Swap submitted! Tx: ' + status.response.txid.slice(0, 10))
      } else {
        toast.success('Swap signed in Xaman')
      }
      setTimeout(() => {
        if (address) fetchBalances(address)
      }, 6500)
      swapInFlightRef.current = false
      setIsSwapping(false)
    },
    [address, fetchBalances, setShowPayloadModal],
  )

  const onSwapRejected = useCallback((reason?: 'cancelled' | 'expired' | 'timeout') => {
    clearPending()
    stripXamanQuery()
    toast.error(reason === 'expired' ? 'Request expired' : 'Swap cancelled or failed')
    swapInFlightRef.current = false
    setIsSwapping(false)
  }, [])

  // Resume Payment swap after return_url / reload
  useEffect(() => {
    if (!address || !resumePoll) return
    const uuid = resolveResumeUuid('swap')
    if (!uuid || resumedUuidRef.current === uuid) return
    resumedUuidRef.current = uuid

    swapInFlightRef.current = true
    setIsSwapping(true)
    resumePoll(uuid, {
      purpose: 'swap',
      maxAttempts: SWAP_POLL_MAX_ATTEMPTS,
      intervalMs: SWAP_POLL_INTERVAL_MS,
      onSigned: onSwapSigned,
      onRejected: onSwapRejected,
    })
  }, [address, resumePoll, onSwapSigned, onSwapRejected])

  const executeSwap = useCallback(async () => {
    if (swapInFlightRef.current || isSwapping) return
    if (!address) {
      toast.error('Connect Xaman wallet first')
      return
    }
    if (!payAmount || !receiveAmount) {
      toast.error('Enter amount and wait for quote')
      return
    }
    if (fromToken.currency === toToken.currency && fromToken.issuer === toToken.issuer) {
      toast.error('Cannot swap a token to itself')
      return
    }

    swapInFlightRef.current = true
    setIsSwapping(true)
    resetPayload()

    const unlockSwap = () => {
      swapInFlightRef.current = false
      setIsSwapping(false)
    }

    try {
      const tx = buildSwapTx({ address, fromToken, toToken, payAmount, receiveAmount })
      const data = await createPayload(
        {
          txjson: tx,
          options: xamanOptions({ expire: 10, submit: true }),
          custom_meta: {
            instruction: `Swap ${payAmount} ${fromToken.currency} → ${toToken.currency}`,
          },
        },
        'Xaman create failed',
      )
      openPayload(data)
      resumedUuidRef.current = data.uuid

      pollPayload(data.uuid, {
        purpose: 'swap',
        maxAttempts: SWAP_POLL_MAX_ATTEMPTS,
        intervalMs: SWAP_POLL_INTERVAL_MS,
        onSigned: onSwapSigned,
        onRejected: onSwapRejected,
      })
    } catch (e: unknown) {
      toast.error('Swap failed: ' + (e instanceof Error ? e.message : String(e)))
      unlockSwap()
    }
  }, [
    isSwapping,
    address,
    payAmount,
    receiveAmount,
    fromToken,
    toToken,
    resetPayload,
    createPayload,
    openPayload,
    pollPayload,
    onSwapSigned,
    onSwapRejected,
  ])

  const clearSwapState = useCallback(() => {
    setReceiveAmount('')
    setQuoteRate('')
  }, [])

  const canSwap =
    !!address && !!payAmount && !!receiveAmount && !isQuoting && parseFloat(receiveAmount) > 0

  return {
    payAmount,
    setPayAmount,
    receiveAmount,
    quoteRate,
    slippage,
    setSlippage,
    isQuoting,
    isSwapping,
    canSwap,
    switchTokens,
    fetchQuote,
    setMax,
    executeSwap,
    clearSwapState,
  }
}
