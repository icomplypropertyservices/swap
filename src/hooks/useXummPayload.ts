import { useState, useRef, useCallback, useEffect } from 'react'
import type { XummPayloadResponse, XummPayloadStatus } from '../types'
import {
  clearPending,
  isMobileUa,
  openXamanUrls,
  stripXamanQuery,
  writePending,
  type PendingPurpose,
} from '../utils/xamanSession'

export type PayloadStatus = 'pending' | 'signed' | 'rejected' | 'expired'

export type PollCallbacks = {
  onSigned: (status: XummPayloadStatus) => void
  onRejected?: (reason: 'cancelled' | 'expired' | 'timeout') => void
  maxAttempts?: number
  intervalMs?: number
  purpose?: PendingPurpose
}

/** Server-only Xaman Platform proxy — keys never leave Vercel. */
const SERVER_PAYLOAD = '/api/xaman/payload'

function errorMessage(status: number, body: string, context: string): string {
  if (status === 503) {
    return 'Xaman not configured on server (set XUMM_API_KEY + XUMM_API_SECRET on Vercel)'
  }
  // Xumm platform error codes (body: { error: { code, reference } })
  try {
    const j = JSON.parse(body)
    const code = j?.error?.code ?? j?.code
    if (code === 810 || code === 812) {
      return (
        'Xaman API credentials rejected (code ' +
        code +
        '). Create a new API Key + Secret at apps.xumm.dev, set XUMM_API_KEY / XUMM_API_SECRET on the riddle-swap Vercel project, and allow origin https://swap.riddlewallet.com'
      )
    }
    if (j?.error && typeof j.error === 'string') return `${context}: ${j.error}`
  } catch {
    /* not JSON */
  }
  if (status === 403) {
    return 'Xaman forbidden — invalid API credentials or origin not allowlisted (apps.xumm.dev)'
  }
  return `${context}: ${status} ${body.slice(0, 180)}`
}

async function serverCreate(body: Record<string, unknown>, context: string) {
  const res = await fetch(SERVER_PAYLOAD, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(errorMessage(res.status, txt, context))
  }
  return res.json() as Promise<XummPayloadResponse>
}

async function serverStatus(uuid: string) {
  const res = await fetch(`${SERVER_PAYLOAD}?uuid=${encodeURIComponent(uuid)}`)
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(errorMessage(res.status, txt, 'Xaman poll'))
  }
  return res.json() as Promise<XummPayloadStatus>
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

  /** Create payload via server only. */
  const createPayload = useCallback(
    async (
      body: Record<string, unknown>,
      errorContext = 'Xaman create failed',
    ): Promise<XummPayloadResponse> => {
      return serverCreate(body, errorContext)
    },
    [],
  )

  const openPayload = useCallback((data: XummPayloadResponse, opts?: { autoOpenMobile?: boolean }) => {
    setCurrentPayload(data)
    setShowPayloadModal(true)
    if (opts?.autoOpenMobile !== false && isMobileUa()) {
      openXamanUrls(data.uuid, data.next?.always)
    }
  }, [])

  const handleStatus = useCallback(
    (status: XummPayloadStatus, callbacks: PollCallbacks): 'done' | 'pending' => {
      if (status.meta?.signed) {
        clearActivePoll()
        clearPending()
        stripXamanQuery()
        setPayloadStatus('signed')
        if (status.response?.txid) setTxHash(status.response.txid)
        callbacks.onSigned(status)
        return 'done'
      }
      if (status.meta?.cancelled || status.meta?.expired) {
        clearActivePoll()
        clearPending()
        stripXamanQuery()
        const reason: 'cancelled' | 'expired' = status.meta?.expired ? 'expired' : 'cancelled'
        setPayloadStatus(reason === 'expired' ? 'expired' : 'rejected')
        callbacks.onRejected?.(reason)
        return 'done'
      }
      return 'pending'
    },
    [clearActivePoll],
  )

  const checkOnce = useCallback(async () => {
    const uuid = activeUuidRef.current
    const callbacks = callbacksRef.current
    if (!uuid || !callbacks || pollInFlightRef.current) return

    pollInFlightRef.current = true
    try {
      const status = await serverStatus(uuid)
      if (activeUuidRef.current !== uuid) return
      handleStatus(status, callbacks)
    } catch {
      /* transient */
    } finally {
      pollInFlightRef.current = false
    }
  }, [handleStatus])

  const pollPayload = useCallback(
    (uuid: string, callbacks: PollCallbacks) => {
      clearActivePoll()
      activeUuidRef.current = uuid
      callbacksRef.current = callbacks
      if (callbacks.purpose) writePending(uuid, callbacks.purpose)

      let attempts = 0
      const maxAttempts = callbacks.maxAttempts ?? 90
      const intervalMs = callbacks.intervalMs ?? 1900
      const deadlineMs = Date.now() + maxAttempts * intervalMs

      const tick = async () => {
        if (pollInFlightRef.current) return
        if (activeUuidRef.current !== uuid) return
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
          const status = await serverStatus(uuid)
          if (activeUuidRef.current !== uuid) return
          handleStatus(status, callbacks)
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
    [clearActivePoll, handleStatus],
  )

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
    /** Alias — same server poll */
    resumePoll: pollPayload,
    resetPayload,
    clearActivePoll,
    closePayloadModal,
    checkOnce,
    activeUuid: () => activeUuidRef.current,
  }
}
