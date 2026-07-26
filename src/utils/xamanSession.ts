/**
 * Persist Xaman pending uuid + connected address (localStorage).
 * Mirrors riddle-bridge return/resume pattern for SignIn, Payment swap, OfferCreate, OfferCancel.
 */

const ADDRESS_KEY = 'riddle.swap.xaman.address'
const PENDING_KEY = 'riddle.swap.xaman.pending'
const PENDING_TTL_MS = 15 * 60 * 1000

export type PendingPurpose = 'signin' | 'swap' | 'limit' | 'cancel'

export type PendingPayload = {
  uuid: string
  purpose: PendingPurpose
  createdAt: number
}

function get(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function set(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* private mode */
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID_RE.test(value)
}

export function readStoredAddress(): string {
  return get(ADDRESS_KEY) || ''
}

export function writeStoredAddress(addr: string) {
  if (addr) set(ADDRESS_KEY, addr)
  else remove(ADDRESS_KEY)
}

export function readPending(): PendingPayload | null {
  const raw = get(PENDING_KEY)
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as PendingPayload
    if (!data?.uuid || !data?.createdAt) return null
    if (Date.now() - data.createdAt > PENDING_TTL_MS) {
      remove(PENDING_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

export function writePending(uuid: string, purpose: PendingPurpose) {
  set(
    PENDING_KEY,
    JSON.stringify({ uuid, purpose, createdAt: Date.now() } satisfies PendingPayload),
  )
}

export function clearPending() {
  remove(PENDING_KEY)
}

/**
 * return_url for Xaman after sign — same SPA screen, not a new product path.
 *
 * - Preserves pathname + other query (swap from/to/amount/chain) + hash
 * - Uses Xaman `{id}` placeholder so return deep-links resume that payload
 * - Literal braces — must not URL-encode (`URLSearchParams` would break `{id}`)
 *
 * Mobile: Xaman substitutes `{id}` → real uuid; SPA also keeps localStorage pending
 * as backup when only a generic marker is present (legacy ?xaman=1 still resumes).
 */
export function buildReturnUrl(_uuid?: string): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const u = new URL(window.location.href)
    u.searchParams.delete('xaman')
    const qs = u.searchParams.toString()
    const pathAndQuery = u.pathname + (qs ? `?${qs}` : '')
    const join = pathAndQuery.includes('?') ? '&' : '?'
    return `${u.origin}${pathAndQuery}${join}xaman={id}${u.hash || ''}`
  } catch {
    return `${window.location.origin}${window.location.pathname}?xaman={id}`
  }
}

/** Resume uuid from ?xaman=<uuid> only (not return markers ?xaman=1 or unsubstituted {id}). */
export function resumeUuidFromUrl(
  href = typeof window !== 'undefined' ? window.location.href : '',
): string | null {
  try {
    const q = new URL(href).searchParams.get('xaman')
    if (!q || q === '1' || q === '{id}') return null
    return UUID_RE.test(q) ? q : null
  } catch {
    return null
  }
}

/** True when URL indicates user just returned from Xaman. */
export function isXamanReturn(
  href = typeof window !== 'undefined' ? window.location.href : '',
): boolean {
  try {
    return new URL(href).searchParams.has('xaman')
  } catch {
    return false
  }
}

export function stripXamanQuery() {
  if (typeof window === 'undefined') return
  try {
    const u = new URL(window.location.href)
    if (!u.searchParams.has('xaman')) return
    u.searchParams.delete('xaman')
    const qs = u.searchParams.toString()
    window.history.replaceState({}, '', u.pathname + (qs ? `?${qs}` : '') + u.hash)
  } catch {
    /* ignore */
  }
}

function returnUrls(uuid?: string) {
  const ret = buildReturnUrl(uuid)
  return ret ? { app: ret, web: ret } : undefined
}

/**
 * Shared options for any Xaman Platform payload (SignIn, Payment, OfferCreate, OfferCancel).
 * return_url brings the user back so the SPA can resume polling.
 */
export function xamanOptions(opts?: {
  submit?: boolean
  expire?: number
  /** Prefer path only until uuid is known; post-create can re-open with uuid deep link */
  uuid?: string
}) {
  const return_url = returnUrls(opts?.uuid)
  return {
    submit: opts?.submit ?? false,
    expire: opts?.expire ?? 10,
    ...(return_url ? { return_url } : {}),
  }
}

/** Production deep-link pair: https://xumm.app/sign/{uuid} + xumm://xumm.app/sign/{uuid} */
export function deepLinks(uuid: string, nextAlways?: string) {
  const web = nextAlways || `https://xumm.app/sign/${uuid}`
  const native = `xumm://xumm.app/sign/${uuid}`
  return { web, native }
}

export function isMobileUa(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

function popupFeatures(): string {
  if (typeof window === 'undefined') return 'popup=yes,width=440,height=720'
  const w = 440
  const h = 720
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - w) / 2))
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - h) / 2))
  return `popup=yes,width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`
}

/**
 * Open Xaman without unloading the swap SPA.
 * - Mobile: native scheme first (page stays); fallback web popup if still visible
 * - Desktop: centered popup for universal link
 */
export function openXamanUrls(uuid: string, nextAlways?: string) {
  const { web, native } = deepLinks(uuid, nextAlways)
  try {
    if (isMobileUa()) {
      const a = document.createElement('a')
      a.href = native
      a.style.display = 'none'
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => {
        if (document.visibilityState === 'visible') {
          window.open(web, 'riddle_xaman_swap', popupFeatures())
        }
      }, 900)
      return
    }
    const popup = window.open(web, 'riddle_xaman_swap', popupFeatures())
    if (!popup) {
      window.open(web, '_blank', 'noopener,noreferrer')
    }
  } catch {
    window.open(web, '_blank', 'noopener,noreferrer')
  }
}

/**
 * Resolve which pending uuid to resume for a given purpose after return/reload.
 * Uses localStorage pending matching purpose; if ?xaman=<uuid> is present it wins.
 */
export function resolveResumeUuid(
  purpose: PendingPurpose | PendingPurpose[],
  href = typeof window !== 'undefined' ? window.location.href : '',
): string | null {
  const purposes = Array.isArray(purpose) ? purpose : [purpose]
  const pending = readPending()
  if (!pending || !purposes.includes(pending.purpose)) return null

  const urlUuid = resumeUuidFromUrl(href)
  if (urlUuid) return urlUuid
  return pending.uuid
}
