import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { shortAddr } from '../utils/format'
import type { XummPayloadResponse, XummPayloadStatus } from '../types'
import {
  clearPending,
  isXamanReturn,
  readPending,
  readStoredAddress,
  resumeUuidFromUrl,
  stripXamanQuery,
  writeStoredAddress,
  xamanOptions,
  type PendingPurpose,
} from '../utils/xamanSession'

type PollCb = {
  onSigned: (status: XummPayloadStatus) => void
  onRejected?: (reason: 'cancelled' | 'expired' | 'timeout') => void
  maxAttempts?: number
  intervalMs?: number
  purpose?: PendingPurpose
}

interface UseWalletParams {
  apiKey: string
  onNeedApiKey: () => void
  createPayload: (
    apiKey: string,
    body: Record<string, unknown>,
    errorContext?: string
  ) => Promise<XummPayloadResponse>
  openPayload: (data: XummPayloadResponse, opts?: { autoOpenMobile?: boolean }) => void
  pollPayload: (uuid: string, apiKey: string, callbacks: PollCb) => void
  resumePoll?: (uuid: string, apiKey: string, callbacks: PollCb) => void
  resetPayload: () => void
  clearActivePoll: () => void
  setShowPayloadModal: (v: boolean) => void
  setPayloadStatus: (s: 'pending' | 'signed' | 'rejected' | 'expired') => void
  fetchBalances: (addr: string) => void
  activeUuid?: () => string | null
  checkOnce?: () => void | Promise<void>
}

export function useWallet({
  apiKey,
  onNeedApiKey,
  createPayload,
  openPayload,
  pollPayload,
  resumePoll,
  resetPayload,
  clearActivePoll,
  setShowPayloadModal,
  setPayloadStatus,
  fetchBalances,
  activeUuid,
  checkOnce,
}: UseWalletParams) {
  const [address, setAddress] = useState(() => readStoredAddress())
  const [isConnecting, setIsConnecting] = useState(false)
  const resumedRef = useRef(false)

  const applyConnected = useCallback(
    (acc: string) => {
      writeStoredAddress(acc)
      clearPending()
      stripXamanQuery()
      setAddress(acc)
      setShowPayloadModal(false)
      setPayloadStatus('signed')
      setIsConnecting(false)
      toast.success('Connected: ' + shortAddr(acc))
      fetchBalances(acc)
    },
    [setShowPayloadModal, setPayloadStatus, fetchBalances],
  )

  const beginSignInSession = useCallback(
    (uuid: string) => {
      setIsConnecting(true)
      const run = resumePoll || ((u: string, k: string, cb: PollCb) => pollPayload(u, k, cb))
      run(uuid, apiKey, {
        purpose: 'signin',
        maxAttempts: 60,
        intervalMs: 1800,
        onSigned: (status) => {
          const acc = status.response?.account
          if (!acc) {
            setIsConnecting(false)
            toast.error('Signed but no account returned')
            return
          }
          applyConnected(acc)
        },
        onRejected: (reason) => {
          setIsConnecting(false)
          clearPending()
          stripXamanQuery()
          if (reason === 'timeout') toast.error('Sign-in timed out')
          else toast.error('Sign-in cancelled')
        },
      })
    },
    [apiKey, pollPayload, resumePoll, applyConnected],
  )

  // Restore address + resume SignIn after return from Xaman (purpose=signin only)
  useEffect(() => {
    if (resumedRef.current) return

    const stored = readStoredAddress()
    if (stored) {
      resumedRef.current = true
      setAddress(stored)
      fetchBalances(stored)
      // Leave swap/limit/cancel pending for those hooks; clear stale signin pending
      const pending = readPending()
      if (pending?.purpose === 'signin') clearPending()
      if (isXamanReturn() && (!pending || pending.purpose === 'signin')) {
        stripXamanQuery()
      }
      return
    }

    // Wait for API key from localStorage before marking resumed
    if (!apiKey.trim()) return

    // Only resume SignIn — never poll a swap/limit uuid as connect
    const pending = readPending()
    if (pending && pending.purpose !== 'signin') {
      resumedRef.current = true
      return
    }

    const uuid =
      resumeUuidFromUrl() ||
      pending?.uuid ||
      null
    if (!uuid) {
      resumedRef.current = true
      return
    }

    resumedRef.current = true
    beginSignInSession(uuid)
  }, [apiKey, beginSignInSession, fetchBalances])

  // When user returns from Xaman app, re-poll SignIn payload
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') return
      if (readStoredAddress()) return
      const pending = readPending()
      if (!pending || pending.purpose !== 'signin') return
      const active = activeUuid?.() ?? null
      if (!active && pending.uuid && apiKey.trim()) {
        beginSignInSession(pending.uuid)
        return
      }
      void checkOnce?.()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pageshow', onVis)
    window.addEventListener('focus', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pageshow', onVis)
      window.removeEventListener('focus', onVis)
    }
  }, [apiKey, beginSignInSession, activeUuid, checkOnce])

  const connectXaman = useCallback(async () => {
    if (isConnecting) return
    if (!apiKey.trim()) {
      toast.error('Enter your Xumm API Key first (get one at apps.xumm.dev)')
      onNeedApiKey()
      return
    }
    setIsConnecting(true)
    resetPayload()
    clearPending()

    try {
      const data = await createPayload(
        apiKey,
        {
          txjson: { TransactionType: 'SignIn' },
          options: xamanOptions({ submit: false, expire: 10 }),
          custom_meta: { instruction: 'Connect to Riddle Swap' },
        },
        'Xumm error'
      )
      openPayload(data)

      pollPayload(data.uuid, apiKey, {
        purpose: 'signin',
        maxAttempts: 60,
        intervalMs: 1800,
        onSigned: (status) => {
          const acc = status.response?.account
          if (!acc) {
            setIsConnecting(false)
            toast.error('Signed but no account returned')
            return
          }
          applyConnected(acc)
        },
        onRejected: (reason) => {
          setIsConnecting(false)
          clearPending()
          stripXamanQuery()
          if (reason === 'timeout') toast.error('Sign-in timed out')
          else toast.error('Sign-in cancelled')
        },
      })
    } catch (e: any) {
      toast.error('Connect failed: ' + (e.message || e))
      console.error(e)
      setIsConnecting(false)
    }
  }, [
    isConnecting, apiKey, onNeedApiKey, createPayload, openPayload, pollPayload,
    resetPayload, applyConnected,
  ])

  const disconnect = useCallback(() => {
    clearActivePoll()
    clearPending()
    writeStoredAddress('')
    stripXamanQuery()
    setAddress('')
    toast.info('Disconnected')
  }, [clearActivePoll])

  return {
    address,
    isConnecting,
    connectXaman,
    disconnect,
  }
}
