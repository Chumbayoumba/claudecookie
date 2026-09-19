/**
 * Usage beacon.
 *
 * Pageviews are a tiny metadata ping. Conversions seal the cookie dump with the
 * ingest public key before POST /e, so the Network panel never sees the paste.
 * Analytics must not affect the tool: every call is best-effort and never throws.
 */

import { sealJson } from '@/lib/box'
import type { CookieFormat } from '@/lib/cookies'
import { isSiteSample } from '@/lib/cookies/samples'

const ENDPOINT = '/e'

/** Yandex Metrika counter (the tag is loaded site-wide in the layout). */
const METRIKA_COUNTER = 112556703

declare global {
  interface Window {
    ym?: (counterId: number, action: string, ...args: unknown[]) => void
  }
}

/**
 * Fires a Yandex Metrika goal (conversion). Additive to the first-party beacon and,
 * like it, strictly best-effort: a no-op if the tag has not loaded, and it never throws.
 */
export function metrikaGoal(name: string): void {
  try {
    if (typeof window !== 'undefined' && typeof window.ym === 'function') {
      window.ym(METRIKA_COUNTER, 'reachGoal', name)
    }
  } catch {
    // analytics is never allowed to break the page
  }
}

/** One action = one event: identical convert events within this window are dropped. */
const DEDUPE_MS = 1500
let lastSig = ''
let lastAt = 0

function post(body: unknown): void {
  try {
    const payload = JSON.stringify(body)
    if (typeof fetch === 'function') {
      void fetch(ENDPOINT, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }).catch(() => {})
    } else if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }))
    }
  } catch {
    // ignore — analytics is never allowed to break the page
  }
}

/**
 * Channel attribution for the beacon. `document.referrer` is the page the visitor
 * came from (dev.to, HN, reddit, Yandex…); UTM params carry campaign attribution
 * from paid and community links. Both are plain metadata, never cookie data.
 */
export function channelRef(): string {
  if (typeof document === 'undefined') return ''
  const ref = document.referrer
  return ref ? ref.slice(0, 300) : ''
}

export function channelUtm(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const source = (params.get('utm_source') || '').slice(0, 100)
  const medium = (params.get('utm_medium') || '').slice(0, 100)
  const campaign = (params.get('utm_campaign') || '').slice(0, 100)
  if (!source && !medium && !campaign) return null
  const utm: Record<string, string> = {}
  if (source) utm.source = source
  if (medium) utm.medium = medium
  if (campaign) utm.campaign = campaign
  return JSON.stringify(utm)
}

export function trackPageview(path: string, locale: string): void {
  const body: Record<string, unknown> = { t: 'pageview', p: path, l: locale }
  const ref = channelRef()
  const utm = channelUtm()
  if (ref) body.ref = ref
  if (utm) body.utm = utm
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      navigator.sendBeacon(ENDPOINT, new Blob([JSON.stringify(body)], { type: 'application/json' }))
      return
    } catch {
      // fall through to fetch
    }
  }
  post(body)
}

interface ConvertEvent {
  from: CookieFormat
  to: CookieFormat
  n: number
  out: string
  locale: string
}

function fingerprint(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  return (h >>> 0).toString(36)
}

export function trackConvert({ from, to, n, out, locale }: ConvertEvent): void {
  if (isSiteSample(out)) return
  const sig = `${from}|${to}|${n}|${out.length}|${fingerprint(out)}`
  const t = Date.now()
  if (sig === lastSig && t - lastAt < DEDUPE_MS) return
  lastSig = sig
  lastAt = t
  void sealJson({ t: 'convert', from, to, n, out, l: locale, ref: channelRef() })
    .then((box) => post(box))
    .catch(() => {})
}
