import type { Token, XummPayloadResponse, XummPayloadStatus } from '../../types'
import type { PendingPurpose } from '../../utils/xamanSession'

export type PollCallbacks = {
  onSigned: (status: XummPayloadStatus) => void
  onRejected?: (reason: 'cancelled' | 'expired' | 'timeout') => void
  maxAttempts?: number
  intervalMs?: number
  purpose?: PendingPurpose
}

export interface UseSwapParams {
  address: string
  apiKey: string
  fromToken: Token
  toToken: Token
  setFromToken: (t: Token) => void
  setToToken: (t: Token) => void
  getBalance: (token: Token) => string
  getClient: () => Promise<any>
  fetchBalances: (addr: string) => void
  onNeedApiKey: () => void
  createPayload: (
    apiKey: string,
    body: Record<string, unknown>,
    errorContext?: string
  ) => Promise<XummPayloadResponse>
  openPayload: (data: XummPayloadResponse, opts?: { autoOpenMobile?: boolean }) => void
  pollPayload: (uuid: string, apiKey: string, callbacks: PollCallbacks) => void
  resumePoll?: (uuid: string, apiKey: string, callbacks: PollCallbacks) => void
  resetPayload: () => void
  setShowPayloadModal: (v: boolean) => void
}
