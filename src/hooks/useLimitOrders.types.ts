import type { Token, XummPayloadResponse } from '../types'
import type { PollCallbacks } from './useXummPayload'

export type LimitExpiration = 'never' | '1h' | '1d' | '7d'

export type { PollCallbacks }

export interface UseLimitOrdersParams {
  address: string
  fromToken: Token
  toToken: Token
  getBalance: (token: Token) => string
  getClient: () => Promise<any>
  fetchBalances: (addr: string) => void
  activeTab: 'swap' | 'limit'
  createPayload: (
    body: Record<string, unknown>,
    errorContext?: string,
  ) => Promise<XummPayloadResponse>
  openPayload: (data: XummPayloadResponse, opts?: { autoOpenMobile?: boolean }) => void
  pollPayload: (uuid: string, callbacks: PollCallbacks) => void
  resumePoll?: (uuid: string, callbacks: PollCallbacks) => void
  resetPayload: () => void
  setShowPayloadModal: (v: boolean) => void
}
