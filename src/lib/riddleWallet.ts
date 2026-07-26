/**
 * Thin Riddle Wallet client for suite apps.
 * Canonical source: riddle-wallet/lib/suite-connect.ts — keep in sync.
 *
 * Protocol:
 *  1. openRiddleWalletConnect({ app: 'swap' })
 *  2. listenRiddleWalletConnected → localStorage `riddle_wallet_session`
 *  3. getSuiteFeeBps() → 50 (0.5%) while session active
 */

export const RIDDLE_WALLET_CONNECTED = 'riddle-wallet:connected' as const
export const RIDDLE_WALLET_DISCONNECTED = 'riddle-wallet:disconnected' as const
export const RIDDLE_WALLET_SESSION_KEY = 'riddle_wallet_session'
export const RIDDLE_WALLET_FEE_BPS = 50
export const DEFAULT_SUITE_FEE_BPS = 85
export const RIDDLE_WALLET_SESSION_TTL_MS = 24 * 60 * 60 * 1000

export const SUITE_APP_IDS = [
  'bridge',
  'swap',
  'cafe',
  'scanner',
  'creator',
  'dev',
] as const

export type SuiteAppId = (typeof SUITE_APP_IDS)[number]
export type RiddleWalletChain = 'xrpl' | 'stellar' | 'solana' | 'evm' | 'bnb' | string

export type RiddleWalletConnectedMessage = {
  type: typeof RIDDLE_WALLET_CONNECTED
  address: string
  chain: RiddleWalletChain
  source: 'riddle-wallet'
  accounts?: Partial<Record<RiddleWalletChain, string>>
  at?: string
  app?: SuiteAppId
}

export type RiddleWalletSession = {
  address: string
  chain: RiddleWalletChain
  source: 'riddle-wallet'
  app?: SuiteAppId
  accounts?: Partial<Record<RiddleWalletChain, string>>
  connectedAt: number
  expiresAt?: number
}

export type BuildConnectUrlOpts = {
  returnUrl?: string
  app: SuiteAppId
  action?: 'connect'
  chain?: RiddleWalletChain
  walletOrigin?: string
}

export type OpenConnectOpts = BuildConnectUrlOpts & {
  mode?: 'popup' | 'redirect' | 'tab'
  popupFeatures?: string
}

export function isSuiteAppId(v: unknown): v is SuiteAppId {
  return typeof v === 'string' && (SUITE_APP_IDS as readonly string[]).includes(v)
}

export function isRiddleWalletConnectedMessage(
  data: unknown,
): data is RiddleWalletConnectedMessage {
  if (!data || typeof data !== 'object') return false
  const m = data as Record<string, unknown>
  return (
    m.type === RIDDLE_WALLET_CONNECTED &&
    m.source === 'riddle-wallet' &&
    typeof m.address === 'string' &&
    m.address.length > 0 &&
    typeof m.chain === 'string'
  )
}

function resolveWalletOrigin(override?: string): string {
  if (override) return override.replace(/\/$/, '')
  const vite = (import.meta as ImportMeta & { env?: Record<string, string> }).env
    ?.VITE_WALLET_URL
  if (vite) return String(vite).replace(/\/$/, '')
  return 'https://wallet.riddlewallet.com'
}

/** https://wallet.riddlewallet.com?return=…&app=swap|…&action=connect */
export function buildRiddleWalletConnectUrl(opts: BuildConnectUrlOpts): string {
  const origin = resolveWalletOrigin(opts.walletOrigin)
  const returnUrl =
    opts.returnUrl || (typeof window !== 'undefined' ? window.location.href : '')
  const u = new URL(origin)
  if (returnUrl) u.searchParams.set('return', returnUrl)
  u.searchParams.set('app', opts.app)
  u.searchParams.set('action', opts.action || 'connect')
  if (opts.chain) u.searchParams.set('chain', opts.chain)
  u.searchParams.set('source', 'suite')
  return u.toString()
}

export function openRiddleWalletConnect(opts: OpenConnectOpts): Window | null {
  if (typeof window === 'undefined') return null
  const href = buildRiddleWalletConnectUrl(opts)
  const mode = opts.mode || 'tab'
  if (mode === 'redirect') {
    window.location.assign(href)
    return null
  }
  if (mode === 'popup') {
    const features =
      opts.popupFeatures ||
      'popup=yes,width=420,height=720,menubar=no,toolbar=no,status=no'
    return window.open(href, 'riddle-wallet-connect', features)
  }
  window.open(href, '_blank', 'noopener,noreferrer')
  return null
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

export function readRiddleWalletSession(): RiddleWalletSession | null {
  if (!canUseStorage()) return null
  try {
    const raw = localStorage.getItem(RIDDLE_WALLET_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RiddleWalletSession
    if (!parsed?.address || parsed.source !== 'riddle-wallet') return null
    const expires =
      parsed.expiresAt ?? (parsed.connectedAt || 0) + RIDDLE_WALLET_SESSION_TTL_MS
    if (Date.now() > expires) {
      localStorage.removeItem(RIDDLE_WALLET_SESSION_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeRiddleWalletSession(
  session: Omit<RiddleWalletSession, 'connectedAt' | 'source'> & {
    connectedAt?: number
    source?: 'riddle-wallet'
  },
): RiddleWalletSession {
  const full: RiddleWalletSession = {
    address: session.address,
    chain: session.chain,
    source: 'riddle-wallet',
    app: session.app,
    accounts: session.accounts,
    connectedAt: session.connectedAt ?? Date.now(),
    expiresAt: session.expiresAt ?? Date.now() + RIDDLE_WALLET_SESSION_TTL_MS,
  }
  if (canUseStorage()) {
    localStorage.setItem(RIDDLE_WALLET_SESSION_KEY, JSON.stringify(full))
  }
  return full
}

export function sessionFromConnectedMessage(
  msg: RiddleWalletConnectedMessage,
): RiddleWalletSession {
  return writeRiddleWalletSession({
    address: msg.address,
    chain: msg.chain,
    app: msg.app,
    accounts: msg.accounts,
  })
}

export function clearRiddleWalletSession(): void {
  if (!canUseStorage()) return
  localStorage.removeItem(RIDDLE_WALLET_SESSION_KEY)
}

export function hasRiddleWalletSession(): boolean {
  return readRiddleWalletSession() != null
}

/** 50 bps (0.5%) with Riddle Wallet session; else fallback (default 85). */
export function getSuiteFeeBps(fallbackBps: number = DEFAULT_SUITE_FEE_BPS): number {
  return hasRiddleWalletSession() ? RIDDLE_WALLET_FEE_BPS : fallbackBps
}

export function feeFromBps(amount: number, bps: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  if (!Number.isFinite(bps) || bps <= 0) return 0
  return (amount * bps) / 10_000
}

export type ConnectedListener = (msg: RiddleWalletConnectedMessage) => void

/** Listen for postMessage + optional `?rw_address=` return handoff. */
export function listenRiddleWalletConnected(
  onConnected: ConnectedListener,
  opts?: { origins?: string[]; acceptQueryHandoff?: boolean },
): () => void {
  if (typeof window === 'undefined') return () => {}

  const walletOrigin = resolveWalletOrigin()
  const allowed = new Set(opts?.origins || [walletOrigin, window.location.origin])

  const handler = (event: MessageEvent) => {
    if (event.origin && !allowed.has(event.origin)) {
      try {
        const o = new URL(event.origin)
        if (
          o.protocol !== 'https:' ||
          !(
            o.hostname === 'riddlewallet.com' ||
            o.hostname.endsWith('.riddlewallet.com')
          )
        ) {
          return
        }
      } catch {
        return
      }
    }
    if (!isRiddleWalletConnectedMessage(event.data)) return
    sessionFromConnectedMessage(event.data)
    onConnected(event.data)
  }

  window.addEventListener('message', handler)

  if (opts?.acceptQueryHandoff !== false) {
    try {
      const params = new URLSearchParams(window.location.search)
      const address = params.get('rw_address') || params.get('address')
      const chain = params.get('rw_chain') || params.get('chain') || 'xrpl'
      const source = params.get('rw_source') || params.get('source')
      if (address && (source === 'riddle-wallet' || params.get('rw_address'))) {
        const msg: RiddleWalletConnectedMessage = {
          type: RIDDLE_WALLET_CONNECTED,
          address,
          chain,
          source: 'riddle-wallet',
        }
        const appParam = params.get('app')
        if (isSuiteAppId(appParam)) msg.app = appParam
        sessionFromConnectedMessage(msg)
        onConnected(msg)
        params.delete('rw_address')
        params.delete('rw_chain')
        params.delete('rw_source')
        params.delete('address')
        params.delete('source')
        const next = params.toString()
        const url =
          window.location.pathname + (next ? `?${next}` : '') + window.location.hash
        window.history.replaceState({}, '', url)
      }
    } catch {
      /* ignore */
    }
  }

  return () => window.removeEventListener('message', handler)
}

/**
 * Open Riddle Wallet with a WalletConnect pairing URI (wc:…).
 * Also attempts a native `wc:` deep link on mobile.
 */
export function openRiddleWalletWithWcUri(
  wcUri: string,
  opts?: {
    app?: SuiteAppId
    returnUrl?: string
    walletOrigin?: string
    mode?: 'popup' | 'redirect' | 'tab'
    tryDeepLink?: boolean
  },
): Window | null {
  if (typeof window === 'undefined' || !wcUri) return null
  const uri = wcUri.startsWith('wc:') ? wcUri : `wc:${wcUri}`

  const tryDeep = opts?.tryDeepLink !== false
  const mobile =
    typeof navigator !== 'undefined' &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  if (tryDeep && mobile) {
    tryOpenWcDeepLink(uri)
  }

  const origin = resolveWalletOrigin(opts?.walletOrigin)
  const returnUrl =
    opts?.returnUrl || (typeof window !== 'undefined' ? window.location.href : '')
  const u = new URL(origin)
  u.searchParams.set('uri', uri)
  u.searchParams.set('wc', uri)
  if (returnUrl) u.searchParams.set('return', returnUrl)
  if (opts?.app) u.searchParams.set('app', opts.app)
  u.searchParams.set('action', 'wc')
  u.searchParams.set('source', 'suite')

  const mode = opts?.mode || 'tab'
  if (mode === 'redirect') {
    window.location.assign(u.toString())
    return null
  }
  if (mode === 'popup') {
    return window.open(
      u.toString(),
      'riddle-wallet-wc',
      'popup=yes,width=420,height=720,menubar=no,toolbar=no,status=no',
    )
  }
  window.open(u.toString(), '_blank', 'noopener,noreferrer')
  return null
}

export function tryOpenWcDeepLink(wcUri: string): void {
  if (typeof window === 'undefined' || !wcUri) return
  const uri = wcUri.startsWith('wc:') ? wcUri : `wc:${wcUri}`
  try {
    const a = document.createElement('a')
    a.href = uri
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } catch {
    try {
      window.location.href = uri
    } catch {
      /* ignore */
    }
  }
}

export function connectViaRiddleWallet(
  app: SuiteAppId,
  opts?: { wcUri?: string | null; mode?: OpenConnectOpts['mode']; chain?: RiddleWalletChain },
): Window | null {
  if (opts?.wcUri) {
    return openRiddleWalletWithWcUri(opts.wcUri, { app, mode: opts.mode || 'tab' })
  }
  return openRiddleWalletConnect({ app, mode: opts?.mode || 'tab', chain: opts?.chain })
}

export const THIS_SUITE_APP: SuiteAppId = 'swap'
