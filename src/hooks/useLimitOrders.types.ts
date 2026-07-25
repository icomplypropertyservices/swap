import type { Token, XummPayloadResponse, XummPayloadStatus } from '../types'
import type { PendingPurpose } from '../utils/xamanSession'

export type LimitExpiration = 'never' | '1h' | '1d' | '7d'

export type PollCallbacks = {
  onSigned: (status: XummPayloadStatus) => void
  onRejected?: (reason: 'cancelled' | 'expired' | 'timeout') => void
  maxAttempts?: number
  intervalMs?: number
  purpose?: PendingPurpose
}

export interface UseLimitOrdersParams {
  address: string
  apiKey: string
  fromToken: Token
  toToken: Token
  getBalance: (token: Token) => string
  getClient: () => Promise<any>
  fetchBalances: (addr: string) => void
  onNeedApiKey: () => void
  activeTab: 'swap' | 'limit'
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
