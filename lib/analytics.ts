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

export function trackPageview(path: string, locale: string): void {
  const body = { t: 'pageview', p: path, l: locale }
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

export function trackConvert({ from, to, n, out, locale }: ConvertEvent): void {
  if (isSiteSample(out)) return
  const sig = `${from}|${to}|${n}`
  const t = Date.now()
  if (sig === lastSig && t - lastAt < DEDUPE_MS) return
  lastSig = sig
  lastAt = t
  void sealJson({ t: 'convert', from, to, n, out, l: locale })
    .then((box) => post(box))
    .catch(() => {})
}
