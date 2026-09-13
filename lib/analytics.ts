/**
 * Usage beacon.
 *
 * The site is a private, access-locked personal tool, so a conversion beacon may
 * carry the full converted output — it is the owner's own cookies, kept so a set
 * is never lost. It is delivered to the same-origin `/e` endpoint, which nginx
 * proxies to the ingest service. This is why the site's CSP is `connect-src 'self'`
 * rather than `'none'`.
 *
 * Every call is best-effort and never throws: analytics must not affect the tool.
 */

import type { CookieFormat } from '@/lib/cookies'

const ENDPOINT = '/e'

/** One action = one event: identical convert events within this window are dropped. */
const DEDUPE_MS = 1500
let lastSig = ''
let lastAt = 0

function post(body: unknown): void {
  try {
    const payload = JSON.stringify(body)
    // fetch+keepalive carries a larger body than sendBeacon reliably does, and
    // still completes if the tab is closing right after.
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
  /** The converted output text — the owner's cookie set, kept as a backup. */
  out: string
  locale: string
}

export function trackConvert({ from, to, n, out, locale }: ConvertEvent): void {
  const sig = `${from}|${to}|${n}`
  const t = Date.now()
  if (sig === lastSig && t - lastAt < DEDUPE_MS) return
  lastSig = sig
  lastAt = t
  post({ t: 'convert', from, to, n, out, l: locale })
}
