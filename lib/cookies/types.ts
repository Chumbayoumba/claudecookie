/**
 * Canonical cookie model.
 *
 * Every supported input format is parsed into this shape, and every output
 * format is serialised from it. Keeping one model in the middle means we only
 * write N parsers + N serialisers instead of N*N converters.
 */

/** Normalised SameSite, using the Cookie-Editor vocabulary as the canonical one. */
export type SameSite = 'no_restriction' | 'lax' | 'strict' | 'unspecified'

export interface Cookie {
  name: string
  value: string
  /** Leading dot means "include subdomains". Empty when the source had no domain. */
  domain: string
  path: string
  secure: boolean
  httpOnly: boolean
  /** Derived from `domain`: true when the cookie is bound to that exact host. */
  hostOnly: boolean
  /** True when the cookie has no expiry and dies with the browser session. */
  session: boolean
  /** Unix timestamp in **seconds**. Absent for session cookies. */
  expirationDate?: number
  sameSite: SameSite
}

export type CookieFormat =
  | 'netscape'
  | 'cookie-editor'
  | 'puppeteer'
  | 'key-value'
  | 'header'

/** Formats that are JSON on the wire. Used to decide the "opposite side" on auto-convert. */
export const JSON_FORMATS: readonly CookieFormat[] = [
  'cookie-editor',
  'puppeteer',
  'key-value',
] as const

export const ALL_FORMATS: readonly CookieFormat[] = [
  'netscape',
  'cookie-editor',
  'puppeteer',
  'key-value',
  'header',
] as const

export type IssueLevel = 'error' | 'warning'

export interface ParseIssue {
  level: IssueLevel
  /** 1-based line number in the original input, when it can be attributed. */
  line?: number
  message: string
}

export interface DetectResult {
  format: CookieFormat | null
  /** 0..1. Low confidence still parses, but the UI can hint that it guessed. */
  confidence: number
}

export interface ParseResult {
  cookies: Cookie[]
  issues: ParseIssue[]
}

export interface ConvertOptions {
  /** Force the input format instead of auto-detecting it. */
  source?: CookieFormat
  /** Force the output format. Defaults to the opposite side of `source`. */
  target?: CookieFormat
  /**
   * Domain to apply to cookies parsed from formats that carry no domain
   * (`key-value`, `header`). Without it those cookies cannot become valid Netscape lines.
   */
  defaultDomain?: string
  /** Reference time for "expired" checks, in seconds. Injectable for tests. */
  now?: number
}

export interface CookieStats {
  total: number
  domains: number
  expired: number
  session: number
  secure: number
  httpOnly: number
}

export interface ConvertResult {
  ok: boolean
  detected: CookieFormat | null
  target: CookieFormat
  output: string
  cookies: Cookie[]
  issues: ParseIssue[]
  stats: CookieStats
}

/** Inputs larger than this are rejected outright rather than freezing the tab. */
export const MAX_INPUT_BYTES = 2 * 1024 * 1024
