import type { Token, XummPayloadResponse } from '../../types'
import type { PollCallbacks } from '../useXummPayload'

export type { PollCallbacks }

export interface UseSwapParams {
  address: string
  fromToken: Token
  toToken: Token
  setFromToken: (t: Token) => void
  setToToken: (t: Token) => void
  getBalance: (token: Token) => string
  getClient: () => Promise<any>
  fetchBalances: (addr: string) => void
  /** Platform fee bps applied to min receive (50 = 0.5%). Default 0. */
  feeBps?: number
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
