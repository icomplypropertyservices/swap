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
  purpose?: PendingPurpose
}

/** Prefer server proxy (keys on Vercel). Optional client API key as fallback. */
const SERVER_PAYLOAD = '/api/xaman/payload'

function xummErrorMessage(status: number, body: string, context: string): string {
  if (status === 503) {
    return 'Xaman not configured on server — set XUMM_API_KEY + XUMM_API_SECRET on Vercel'
  }
  if (status === 403) {
    return '403 Forbidden — Invalid Xumm API key or app origin not allowed (apps.xumm.dev)'
  }
  return `${context}: ${status} ${body.slice(0, 180)}`
}

export function useXummPayload() {
  const [showPayloadModal, setShowPayloadModal] = useState(false)
  const [currentPayload, setCurrentPayload] = useState<XummPayloadResponse | null>(null)
  const [payloadStatus, setPayloadStatus] = useState<PayloadStatus>('pending')
  const [txHash, setTxHash] = useState('')
  const [serverReady, setServerReady] = useState<boolean | null>(null)

  const activePollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollInFlightRef = useRef(false)
  const activeUuidRef = useRef<string | null>(null)
  /** Empty string = use server proxy */
  const apiKeyRef = useRef('')
  const callbacksRef = useRef<PollCallbacks | null>(null)
  const visibilityHandlerRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/health')
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setServerReady(j?.xamanReady === true)
      })
      .catch(() => {
        if (!cancelled) setServerReady(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

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

  const createPayload = useCallback(
    async (
      apiKey: string,
      body: Record<string, unknown>,
      errorContext = 'Xumm create failed',
    ): Promise<XummPayloadResponse> => {
      const useServer = !apiKey.trim() || serverReady !== false
      if (useServer) {
        const res = await fetch(SERVER_PAYLOAD, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.ok) return res.json()
        // Fall through to client key if server missing and user has a key
        if (res.status === 503 && apiKey.trim()) {
          /* client fallback below */
        } else {
          const txt = await res.text()
          throw new Error(xummErrorMessage(res.status, txt, errorContext))
        }
      }

      if (!apiKey.trim()) {
        throw new Error(
          'Xaman not available — server keys not set. Add XUMM_API_KEY/SECRET on Vercel or paste a key.',
        )
      }

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
    },
    [serverReady],
  )

  const openPayload = useCallback((data: XummPayloadResponse, opts?: { autoOpenMobile?: boolean }) => {
    setCurrentPayload(data)
    setShowPayloadModal(true)
    if (opts?.autoOpenMobile !== false && isMobileUa()) {
      openXamanUrls(data.uuid, data.next?.always)
    }
  }, [])

  const fetchStatus = useCallback(async (uuid: string, apiKey: string) => {
    if (!apiKey.trim()) {
      const res = await fetch(`${SERVER_PAYLOAD}?uuid=${encodeURIComponent(uuid)}`)
      return res.json() as Promise<XummPayloadStatus>
    }
    const res = await fetch(`${XUMM_API}/${uuid}`, {
      headers: { 'X-API-Key': apiKey.trim() },
    })
    return res.json() as Promise<XummPayloadStatus>
  }, [])

  const checkOnce = useCallback(async () => {
    const current = activeUuidRef.current
    const apiKey = apiKeyRef.current
    const callbacks = callbacksRef.current
    if (!current || !callbacks || pollInFlightRef.current) return
    // server mode: apiKey may be empty

    pollInFlightRef.current = true
    try {
      const status = await fetchStatus(current, apiKey)
      if (activeUuidRef.current !== current) return

      if (status.meta?.signed) {
        clearActivePoll()
        clearPending()
        stripXamanQuery()
        setPayloadStatus('signed')
        if (status.response?.txid) setTxHash(status.response.txid)
        callbacks.onSigned(status)
      } else if (status.meta?.cancelled || status.meta?.expired) {
        clearActivePoll()
        clearPending()
        stripXamanQuery()
        const reason: 'cancelled' | 'expired' = status.meta?.expired ? 'expired' : 'cancelled'
        setPayloadStatus(reason === 'expired' ? 'expired' : 'rejected')
        callbacks.onRejected?.(reason)
      }
    } catch {
      /* ignore transient */
    } finally {
      pollInFlightRef.current = false
    }
  }, [clearActivePoll, fetchStatus])

  const pollPayload = useCallback(
    (uuid: string, apiKey: string, callbacks: PollCallbacks) => {
      clearActivePoll()
      activeUuidRef.current = uuid
      // empty key → poll via server proxy
      apiKeyRef.current = apiKey.trim()
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

          const status = await fetchStatus(uuid, apiKeyRef.current)
          if (activeUuidRef.current !== uuid) return

          if (status.meta?.signed) {
            clearActivePoll()
            clearPending()
            stripXamanQuery()
            setPayloadStatus('signed')
            if (status.response?.txid) setTxHash(status.response.txid)
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
          /* keep polling */
        } finally {
          pollInFlightRef.current = false
        }
      }

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
    },
    [clearActivePoll, fetchStatus],
  )

  const resumePoll = pollPayload

  return {
    showPayloadModal,
    setShowPayloadModal,
    currentPayload,
    payloadStatus,
    setPayloadStatus,
    txHash,
    serverReady,
    createPayload,
    openPayload,
    pollPayload,
    resumePoll,
    resetPayload,
    clearActivePoll,
    closePayloadModal,
    checkOnce,
    activeUuid: () => activeUuidRef.current,
  }
}
