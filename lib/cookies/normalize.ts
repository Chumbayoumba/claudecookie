import type { Cookie, SameSite } from './types'

/**
 * Seconds vs milliseconds: unix seconds are ~1.7e9 today and stay below 1e11
 * until the year 5138, so anything at or above that threshold is milliseconds.
 */
const MS_THRESHOLD = 1e11

export interface ExpiryInfo {
  expirationDate?: number
  session: boolean
}

/**
 * Normalises every expiry spelling we encounter into unix **seconds**.
 *
 * Session cookies are signalled differently by every tool: Netscape writes `0`,
 * Puppeteer writes `-1`, Cookie-Editor omits the field and sets `session: true`.
 */
export function normalizeExpires(raw: unknown): ExpiryInfo {
  if (raw === undefined || raw === null || raw === '') return { session: true }

  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n)) return { session: true }

  // 0 and any negative value (Puppeteer's -1) mean "dies with the session".
  if (n <= 0) return { session: true }

  const seconds = n >= MS_THRESHOLD ? n / 1000 : n
  return { expirationDate: Math.round(seconds), session: false }
}

/** Maps any tool's SameSite spelling onto the canonical vocabulary. */
export function normalizeSameSite(raw: unknown): SameSite {
  if (typeof raw !== 'string') return 'unspecified'
  switch (raw.trim().toLowerCase()) {
    case 'none':
    case 'no_restriction':
    case 'norestriction':
      return 'no_restriction'
    case 'lax':
      return 'lax'
    case 'strict':
      return 'strict'
    default:
      return 'unspecified'
  }
}

/** Canonical SameSite -> the `None | Lax | Strict` spelling Puppeteer/Playwright expect. */
export function toPuppeteerSameSite(s: SameSite): 'None' | 'Lax' | 'Strict' | undefined {
  switch (s) {
    case 'no_restriction':
      return 'None'
    case 'lax':
      return 'Lax'
    case 'strict':
      return 'Strict'
    default:
      return undefined
  }
}

/**
 * A leading dot is the Netscape way of saying "include subdomains"; the browser
 * extension formats express the same thing as `hostOnly`. We keep the dot on the
 * domain string and derive `hostOnly` from it so there is a single source of truth.
 */
export function normalizeDomain(domain: unknown, includeSubdomains?: boolean): string {
  let d = typeof domain === 'string' ? domain.trim() : ''
  if (!d) return ''

  // Tolerate a full URL or a host:port pasted in place of a bare domain.
  d = d.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/:\d+$/, '')
  d = d.toLowerCase()

  if (includeSubdomains === true && !d.startsWith('.')) d = `.${d}`
  if (includeSubdomains === false && d.startsWith('.')) d = d.slice(1)

  return d
}

export function isHostOnly(domain: string): boolean {
  return domain.length > 0 && !domain.startsWith('.')
}

/** Builds a fully-populated cookie, filling in the defaults a browser would apply. */
export function makeCookie(input: {
  name: string
  value: string
  domain?: string
  path?: string
  secure?: boolean
  httpOnly?: boolean
  hostOnly?: boolean
  sameSite?: SameSite
  expires?: unknown
  session?: boolean
}): Cookie {
  const domain = input.domain ?? ''
  const expiry = normalizeExpires(input.expires)
  // An explicit `session: true` from the source wins over a stray expiry value.
  const session = input.session === true ? true : expiry.session

  return {
    name: input.name,
    value: input.value,
    domain,
    path: input.path && input.path.trim() ? input.path.trim() : '/',
    secure: input.secure ?? false,
    httpOnly: input.httpOnly ?? false,
    hostOnly: input.hostOnly ?? isHostOnly(domain),
    session,
    ...(session ? {} : { expirationDate: expiry.expirationDate }),
    sameSite: input.sameSite ?? 'unspecified',
  }
}

export function isExpired(cookie: Cookie, now: number): boolean {
  return !cookie.session && cookie.expirationDate !== undefined && cookie.expirationDate < now
}

/** Strips a UTF-8 BOM and normalises CRLF/CR line endings to LF. */
export function cleanInput(input: string): string {
  return input.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
}
