import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { shortAddr } from '../utils/format'
import type { XummPayloadResponse } from '../types'
import type { PollCallbacks } from './useXummPayload'
import {
  clearPending,
  isXamanReturn,
  readPending,
  readStoredAddress,
  resumeUuidFromUrl,
  stripXamanQuery,
  writeStoredAddress,
  xamanOptions,
} from '../utils/xamanSession'
import {
  clearRiddleWalletSession,
  hasRiddleWalletSession,
  listenRiddleWalletConnected,
  openRiddleWalletConnect,
  readRiddleWalletSession,
  THIS_SUITE_APP,
  type RiddleWalletConnectedMessage,
} from '../lib/riddleWallet'

export type WalletProvider = 'xaman' | 'riddle-wallet' | null

interface UseWalletParams {
  createPayload: (
    body: Record<string, unknown>,
    errorContext?: string,
  ) => Promise<XummPayloadResponse>
  openPayload: (data: XummPayloadResponse, opts?: { autoOpenMobile?: boolean }) => void
  pollPayload: (uuid: string, callbacks: PollCallbacks) => void
  resumePoll?: (uuid: string, callbacks: PollCallbacks) => void
  resetPayload: () => void
  clearActivePoll: () => void
  setShowPayloadModal: (v: boolean) => void
  setPayloadStatus: (s: 'pending' | 'signed' | 'rejected' | 'expired') => void
  fetchBalances: (addr: string) => void
  activeUuid?: () => string | null
  checkOnce?: () => void | Promise<void>
}

function providerFromSession(): WalletProvider {
  if (hasRiddleWalletSession()) return 'riddle-wallet'
  if (readStoredAddress()) return 'xaman'
  return null
}

export function useWallet({
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
  const [address, setAddress] = useState(() => {
    const rw = readRiddleWalletSession()
    return rw?.address || readStoredAddress()
  })
  const [walletProvider, setWalletProvider] = useState<WalletProvider>(() => providerFromSession())
  const [isConnecting, setIsConnecting] = useState(false)
  const resumedRef = useRef(false)

  const applyConnected = useCallback(
    (acc: string, provider: WalletProvider = 'xaman') => {
      writeStoredAddress(acc)
      clearPending()
      stripXamanQuery()
      setAddress(acc)
      setWalletProvider(provider)
      setShowPayloadModal(false)
      setPayloadStatus('signed')
      setIsConnecting(false)
      toast.success(
        provider === 'riddle-wallet'
          ? 'Riddle Wallet: ' + shortAddr(acc)
          : 'Connected: ' + shortAddr(acc),
      )
      fetchBalances(acc)
    },
    [setShowPayloadModal, setPayloadStatus, fetchBalances],
  )

  const beginSignInSession = useCallback(
    (uuid: string) => {
      setIsConnecting(true)
      const run = resumePoll || pollPayload
      run(uuid, {
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
          applyConnected(acc, 'xaman')
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
    [pollPayload, resumePoll, applyConnected],
  )

  // Restore address + resume SignIn after return from Xaman
  useEffect(() => {
    if (resumedRef.current) return

    const rw = readRiddleWalletSession()
    if (rw?.address) {
      resumedRef.current = true
      writeStoredAddress(rw.address)
      setAddress(rw.address)
      setWalletProvider('riddle-wallet')
      fetchBalances(rw.address)
      return
    }

    const stored = readStoredAddress()
    if (stored) {
      resumedRef.current = true
      setAddress(stored)
      setWalletProvider('xaman')
      fetchBalances(stored)
      const pending = readPending()
      if (pending?.purpose === 'signin') clearPending()
      if (isXamanReturn() && (!pending || pending.purpose === 'signin')) {
        stripXamanQuery()
      }
      return
    }

    const pending = readPending()
    if (pending && pending.purpose !== 'signin') {
      resumedRef.current = true
      return
    }

    const uuid = resumeUuidFromUrl() || pending?.uuid || null
    if (!uuid) {
      resumedRef.current = true
      return
    }

    resumedRef.current = true
    beginSignInSession(uuid)
  }, [beginSignInSession, fetchBalances])

  // Listen for Riddle Wallet postMessage + ?rw_address= return handoff
  useEffect(() => {
    return listenRiddleWalletConnected((msg: RiddleWalletConnectedMessage) => {
      const acc = msg.address
      if (!acc) return
      applyConnected(acc, 'riddle-wallet')
    })
  }, [applyConnected])

  // Re-poll SignIn when user returns from Xaman app
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') return
      if (readStoredAddress() || hasRiddleWalletSession()) return
      const pending = readPending()
      if (!pending || pending.purpose !== 'signin') return
      const active = activeUuid?.() ?? null
      if (!active && pending.uuid) {
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
  }, [beginSignInSession, activeUuid, checkOnce])

  const connectXaman = useCallback(async () => {
    if (isConnecting) return
    setIsConnecting(true)
    resetPayload()
    clearPending()

    try {
      const data = await createPayload(
        {
          txjson: { TransactionType: 'SignIn' },
          options: xamanOptions({ submit: false, expire: 10 }),
          custom_meta: { instruction: 'Connect to Riddle Swap' },
        },
        'Xaman connect failed',
      )
      openPayload(data)

      pollPayload(data.uuid, {
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
          // Xaman connect does not write riddle_wallet_session
          clearRiddleWalletSession()
          applyConnected(acc, 'xaman')
        },
        onRejected: (reason) => {
          setIsConnecting(false)
          clearPending()
          stripXamanQuery()
          if (reason === 'timeout') toast.error('Sign-in timed out')
          else toast.error('Sign-in cancelled')
        },
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error('Connect failed: ' + msg)
      console.error(e)
      setIsConnecting(false)
    }
  }, [
    isConnecting,
    createPayload,
    openPayload,
    pollPayload,
    resetPayload,
    applyConnected,
  ])

  /** Deep-link to wallet.riddlewallet.com?app=swap&action=connect */
  const connectRiddleWallet = useCallback(() => {
    if (isConnecting) return
    setIsConnecting(true)
    try {
      openRiddleWalletConnect({
        app: THIS_SUITE_APP,
        chain: 'xrpl',
        mode: 'tab',
      })
      toast.info('Complete connect in Riddle Wallet, then return here')
      // Allow user to interact again; session arrives via postMessage / return URL
      window.setTimeout(() => setIsConnecting(false), 2500)
    } catch (e: unknown) {
      toast.error('Could not open Riddle Wallet')
      console.error(e)
      setIsConnecting(false)
    }
  }, [isConnecting])

  const disconnect = useCallback(() => {
    clearActivePoll()
    clearPending()
    clearRiddleWalletSession()
    writeStoredAddress('')
    stripXamanQuery()
    setAddress('')
    setWalletProvider(null)
    toast.info('Disconnected')
  }, [clearActivePoll])

  return {
    address,
    isConnecting,
    walletProvider,
    connectXaman,
    connectRiddleWallet,
    disconnect,
  }
}
