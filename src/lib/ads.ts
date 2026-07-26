/**
 * Sponsored creative fetch for swap.banner / swap.sidebar slots.
 *
 * Env (either prefix works — Vite exposes NEXT_PUBLIC_ via vite.config envPrefix):
 *   NEXT_PUBLIC_ADS_API_BASE / VITE_ADS_API_BASE — origin, default https://dev.riddlewallet.com
 *   NEXT_PUBLIC_ADS_API / VITE_ADS_API — optional full active-ads URL (slot query still appended)
 */

export type AdSlotId = 'swap.banner' | 'swap.sidebar'

export interface AdCreative {
  id: string
  slot: string
  title: string
  body?: string
  imageUrl?: string
  clickUrl: string
  sponsor?: string
  cta?: string
}

const DEFAULT_ADS_BASE = 'https://dev.riddlewallet.com'

const MOCK_CREATIVES: Record<AdSlotId, AdCreative> = {
  'swap.banner': {
    id: 'mock-swap-banner',
    slot: 'swap.banner',
    title: 'Riddle Wallet — full suite on XRPL',
    body: 'Trade, bridge, and manage assets across the Riddle ecosystem.',
    imageUrl: '/logos/wallet.jpg',
    clickUrl: 'https://riddlewallet.com',
    sponsor: 'Riddle Suite',
    cta: 'Open suite',
  },
  'swap.sidebar': {
    id: 'mock-swap-sidebar',
    slot: 'swap.sidebar',
    title: 'Riddle Bridge',
    body: 'Move value across chains with Xaman signing.',
    imageUrl: '/logos/bridge.jpg',
    clickUrl: 'https://riddlewallet.com',
    sponsor: 'Riddle Suite',
    cta: 'Explore',
  },
}

function env(key: string): string | undefined {
  const meta = import.meta.env as Record<string, string | undefined>
  const v = meta[key]
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

/** Resolved ads API base (no trailing slash). */
export function getAdsApiBase(): string {
  const base =
    env('NEXT_PUBLIC_ADS_API_BASE') ||
    env('VITE_ADS_API_BASE') ||
    DEFAULT_ADS_BASE
  return base.replace(/\/+$/, '')
}

/** Full active-creative endpoint for a slot. */
export function getActiveAdsUrl(slot: AdSlotId | string): string {
  const full =
    env('NEXT_PUBLIC_ADS_API') ||
    env('VITE_ADS_API')
  if (full) {
    const u = new URL(full)
    u.searchParams.set('slot', slot)
    return u.toString()
  }
  return `${getAdsApiBase()}/api/ads/active?slot=${encodeURIComponent(slot)}`
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function pickStr(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

/** Normalize heterogeneous API payloads into AdCreative. */
export function normalizeCreative(raw: unknown, slot: string): AdCreative | null {
  if (!raw) return null
  let obj = asRecord(raw)
  if (!obj) return null

  // Unwrap common envelopes
  const nested =
    asRecord(obj.creative) ||
    asRecord(obj.ad) ||
    asRecord(obj.data) ||
    (Array.isArray(obj.ads) ? asRecord(obj.ads[0]) : null) ||
    (Array.isArray(obj.creatives) ? asRecord(obj.creatives[0]) : null)
  if (nested) obj = nested

  // Empty / inactive signal
  if (obj.active === false || obj.enabled === false) return null

  const clickUrl = pickStr(obj, ['clickUrl', 'click_url', 'url', 'href', 'link'])
  const title = pickStr(obj, ['title', 'headline', 'name', 'text'])
  if (!clickUrl || !title) return null

  return {
    id: pickStr(obj, ['id', '_id', 'creativeId', 'creative_id']) || `ad-${slot}`,
    slot: pickStr(obj, ['slot']) || slot,
    title,
    body: pickStr(obj, ['body', 'description', 'subtitle', 'tagline']),
    imageUrl: pickStr(obj, ['imageUrl', 'image_url', 'image', 'bannerUrl', 'banner_url', 'creativeUrl']),
    clickUrl,
    sponsor: pickStr(obj, ['sponsor', 'advertiser', 'brand', 'label']),
    cta: pickStr(obj, ['cta', 'ctaLabel', 'cta_label', 'buttonText']),
  }
}

/**
 * Fetch active creative for a slot.
 * Falls back to a local mock when the network/API is down or returns nothing.
 */
export async function fetchActiveCreative(
  slot: AdSlotId,
  opts?: { signal?: AbortSignal; useMockFallback?: boolean },
): Promise<AdCreative | null> {
  const useMock = opts?.useMockFallback !== false
  const url = getActiveAdsUrl(slot)

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: opts?.signal,
      // Avoid stale cached empty/404 during rollouts
      cache: 'no-store',
    })
    if (!res.ok) {
      if (useMock) return MOCK_CREATIVES[slot] ?? null
      return null
    }
    const json: unknown = await res.json()
    const creative = normalizeCreative(json, slot)
    if (creative) return creative
    if (useMock) return MOCK_CREATIVES[slot] ?? null
    return null
  } catch {
    if (opts?.signal?.aborted) return null
    if (useMock) return MOCK_CREATIVES[slot] ?? null
    return null
  }
}

export function getMockCreative(slot: AdSlotId): AdCreative {
  return MOCK_CREATIVES[slot]
}
