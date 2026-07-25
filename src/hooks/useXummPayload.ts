import { useState, useRef, useCallback, useEffect } from 'react'
import type { XummPayloadResponse, XummPayloadStatus } from '../types'
import { XUMM_API } from '../utils/xrpl'
import {
  clearPending,
  isMobileUa,
  openXamanUrls,
  stripXamanQuery,
  writePending,
  type PendingPurpose,
} from '../utils/xamanSession'

export type PayloadStatus = 'pending' | 'signed' | 'rejected' | 'expired'

export interface PollCallbacks {
  onSigned: (status: XummPayloadStatus) => void
  onRejected?: (reason: 'cancelled' | 'expired' | 'timeout') => void
  maxAttempts?: number
  intervalMs?: number
  /** Persist for resume after return from Xaman */
  purpose?: PendingPurpose
}

function xummErrorMessage(status: number, body: string, context: string): string {
  if (status === 403) {
    return '403 Forbidden - Invalid Xumm API key or app origin not allowed. Get/verify key at https://apps.xumm.dev and ensure "Allowed Origins" includes your domain (or "*")'
  }
  return `${context}: ${status} ${body}`
}

export function useXummPayload() {
  const [showPayloadModal, setShowPayloadModal] = useState(false)
  const [currentPayload, setCurrentPayload] = useState<XummPayloadResponse | null>(null)
  const [payloadStatus, setPayloadStatus] = useState<PayloadStatus>('pending')
  const [txHash, setTxHash] = useState('')

  const activePollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollInFlightRef = useRef(false)
  const activeUuidRef = useRef<string | null>(null)
  const apiKeyRef = useRef('')
  const callbacksRef = useRef<PollCallbacks | null>(null)
  const visibilityHandlerRef = useRef<(() => void) | null>(null)

  const clearActivePoll = useCallback(() => {
    if (activePollRef.current) {
      clearInterval(activePollRef.current)
      activePollRef.current = null
    }
    pollInFlightRef.current = false
    activeUuidRef.current = null
    callbacksRef.current = null
    if (visibilityHandlerRef.current) {
      document.removeEventListener('visibilitychange', visibilityHandlerRef.current)
      window.removeEventListener('pageshow', visibilityHandlerRef.current)
      window.removeEventListener('focus', visibilityHandlerRef.current)
      visibilityHandlerRef.current = null
    }
  }, [])

  const resetPayload = useCallback(() => {
    setPayloadStatus('pending')
    setTxHash('')
    setCurrentPayload(null)
  }, [])

  const closePayloadModal = useCallback(() => {
    clearActivePoll()
    clearPending()
    stripXamanQuery()
    setShowPayloadModal(false)
    setCurrentPayload(null)
    setPayloadStatus('pending')
  }, [clearActivePoll])

  const createPayload = useCallback(async (
    apiKey: string,
    body: Record<string, unknown>,
    errorContext = 'Xumm create failed'
  ): Promise<XummPayloadResponse> => {
    const res = await fetch(XUMM_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey.trim(),
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const txt = await res.text()
      throw new Error(xummErrorMessage(res.status, txt, errorContext))
    }

    return res.json()
  }, [])

  const openPayload = useCallback((data: XummPayloadResponse, opts?: { autoOpenMobile?: boolean }) => {
    setCurrentPayload(data)
    setShowPayloadModal(true)
    // Mobile: try native app so user can approve and return via return_url (SPA stays loaded)
    if (opts?.autoOpenMobile !== false && isMobileUa()) {
      openXamanUrls(data.uuid, data.next?.always)
    }
  }, [])

  const checkOnce = useCallback(async () => {
    const current = activeUuidRef.current
    const apiKey = apiKeyRef.current
    const callbacks = callbacksRef.current
    if (!current || !apiKey || !callbacks || pollInFlightRef.current) return

    pollInFlightRef.current = true
    try {
      const res = await fetch(`${XUMM_API}/${current}`, {
        headers: { 'X-API-Key': apiKey.trim() },
      })
      const status: XummPayloadStatus = await res.json()
      if (activeUuidRef.current !== current) return

      if (status.meta?.signed) {
        clearActivePoll()
        clearPending()
        stripXamanQuery()
        setPayloadStatus('signed')
        if (status.response?.txid) {
          setTxHash(status.response.txid)
        }
        callbacks.onSigned(status)
      } else if (status.meta?.cancelled || status.meta?.expired) {
        clearActivePoll()
        clearPending()
        stripXamanQuery()
        const reason: 'cancelled' | 'expired' =
          status.meta?.expired ? 'expired' : 'cancelled'
        setPayloadStatus(reason === 'expired' ? 'expired' : 'rejected')
        callbacks.onRejected?.(reason)
      }
    } catch {
      /* ignore transient */
    } finally {
      pollInFlightRef.current = false
    }
  }, [clearActivePoll])

  const pollPayload = useCallback((
    uuid: string,
    apiKey: string,
    callbacks: PollCallbacks
  ) => {
    clearActivePoll()
    activeUuidRef.current = uuid
    apiKeyRef.current = apiKey
    callbacksRef.current = callbacks
    if (callbacks.purpose) writePending(uuid, callbacks.purpose)

    let attempts = 0
    const maxAttempts = callbacks.maxAttempts ?? 90
    const intervalMs = callbacks.intervalMs ?? 1900
    const deadlineMs = Date.now() + maxAttempts * intervalMs

    const tick = async () => {
      if (pollInFlightRef.current) return
      const current = activeUuidRef.current
      if (!current || current !== uuid) return
      pollInFlightRef.current = true
      attempts += 1
      try {
        if (Date.now() > deadlineMs || attempts > maxAttempts) {
          clearActivePoll()
          clearPending()
          stripXamanQuery()
          setPayloadStatus('rejected')
          callbacks.onRejected?.('timeout')
          return
        }

        const res = await fetch(`${XUMM_API}/${uuid}`, {
          headers: { 'X-API-Key': apiKey.trim() },
        })
        const status: XummPayloadStatus = await res.json()
        if (activeUuidRef.current !== uuid) return

        if (status.meta?.signed) {
          clearActivePoll()
          clearPending()
          stripXamanQuery()
          setPayloadStatus('signed')
          if (status.response?.txid) {
            setTxHash(status.response.txid)
          }
          callbacks.onSigned(status)
        } else if (status.meta?.cancelled || status.meta?.expired) {
          clearActivePoll()
          clearPending()
          stripXamanQuery()
          const reason: 'cancelled' | 'expired' =
            status.meta?.expired ? 'expired' : 'cancelled'
          setPayloadStatus(reason === 'expired' ? 'expired' : 'rejected')
          callbacks.onRejected?.(reason)
        }
      } catch {
        // keep polling until maxAttempts / deadline
      } finally {
        pollInFlightRef.current = false
      }
    }

    // When user returns from Xaman (app switch / popup closed), re-check immediately
    const onReturn = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (!activeUuidRef.current) return
      void tick()
    }
    visibilityHandlerRef.current = onReturn
    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('pageshow', onReturn)
    window.addEventListener('focus', onReturn)

    activePollRef.current = setInterval(() => {
      void tick()
    }, intervalMs)
    void tick()
  }, [clearActivePoll])

  /** Resume a pending uuid after reload / return_url */
  const resumePoll = useCallback(
    (
      uuid: string,
      apiKey: string,
      callbacks: PollCallbacks,
      shell?: Partial<XummPayloadResponse>,
    ) => {
      setCurrentPayload({
        uuid,
        next: { always: `https://xumm.app/sign/${uuid}` },
        refs: {},
        ...shell,
      } as XummPayloadResponse)
      setShowPayloadModal(true)
      setPayloadStatus('pending')
      pollPayload(uuid, apiKey, callbacks)
    },
    [pollPayload],
  )

  const activeUuid = useCallback(() => activeUuidRef.current, [])

  useEffect(() => () => clearActivePoll(), [clearActivePoll])

  return {
    showPayloadModal,
    currentPayload,
    payloadStatus,
    txHash,
    setPayloadStatus,
    setTxHash,
    setShowPayloadModal,
    clearActivePoll,
    resetPayload,
    closePayloadModal,
    createPayload,
    openPayload,
    pollPayload,
    resumePoll,
    checkOnce,
    activeUuid,
  }
}
