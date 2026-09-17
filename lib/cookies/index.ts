import { detectFormat, oppositeFormat } from './detect'
import { isLossy } from './meta'
import { cleanInput } from './normalize'
import { splitCookieSets } from './split'
import { parseHeader } from './parse/header'
import { parseJson } from './parse/json'
import { parseNetscape } from './parse/netscape'
import { serializeCookieEditor } from './serialize/cookieEditor'
import { serializeHeader } from './serialize/header'
import { serializeKeyValue } from './serialize/keyValue'
import { serializeNetscape } from './serialize/netscape'
import { serializePuppeteer } from './serialize/puppeteer'
import { computeStats } from './stats'
import {
  MAX_INPUT_BYTES,
  type ConvertOptions,
  type ConvertResult,
  type Cookie,
  type CookieFormat,
  type CookieStats,
  type ParseIssue,
  type ParseResult,
} from './types'

export * from './types'
export { splitCookieSets, MAX_SETS } from './split'
export { detectFormat, oppositeFormat } from './detect'
export { FORMAT_META, isLossy } from './meta'
export { computeStats } from './stats'
export { isExpired } from './normalize'

const EMPTY_STATS: CookieStats = {
  total: 0,
  domains: 0,
  expired: 0,
  session: 0,
  secure: 0,
  httpOnly: 0,
}

/**
 * The single entry point: text in, converted text out.
 *
 * Detects the input format unless told otherwise, parses it into the canonical
 * cookie model, then serialises to the requested target - defaulting to the
 * other side of the Netscape/JSON divide, which is what the UI wants on paste.
 */
export function convert(input: string, opts: ConvertOptions = {}): ConvertResult {
  const now = opts.now ?? Math.floor(Date.now() / 1000)
  const text = cleanInput(input)

  if (!text.trim()) {
    return {
      ok: false,
      detected: null,
      target: opts.target ?? 'cookie-editor',
      output: '',
      cookies: [],
      issues: [],
      stats: EMPTY_STATS,
    }
  }

  if (byteLength(text) > MAX_INPUT_BYTES) {
    return {
      ok: false,
      detected: null,
      target: opts.target ?? 'cookie-editor',
      output: '',
      cookies: [],
      issues: [{ level: 'error', message: 'issue.tooLarge' }],
      stats: EMPTY_STATS,
    }
  }

  const detected = opts.source ?? detectFormat(text).format
  const target = opts.target ?? (detected ? oppositeFormat(detected) : 'cookie-editor')

  if (!detected) {
    return {
      ok: false,
      detected: null,
      target,
      output: '',
      cookies: [],
      issues: [{ level: 'error', message: 'issue.unknownFormat' }],
      stats: EMPTY_STATS,
    }
  }

  const parsed = runParser(detected, text, opts)
  const { cookies, issues } = dedupe(parsed)

  if (cookies.length === 0) {
    return { ok: false, detected, target, output: '', cookies: [], issues, stats: EMPTY_STATS }
  }

  issues.push(...lossWarnings(cookies, detected, target))

  return {
    ok: true,
    detected,
    target,
    output: serialize(target, cookies),
    cookies,
    issues,
    stats: computeStats(cookies, now),
  }
}

/**
 * Splits a paste into separate cookie sets and converts each independently.
 * A single set (the common case) yields a one-element array identical to `convert()`.
 */
export function convertBatch(input: string, opts: ConvertOptions = {}): ConvertResult[] {
  const sets = splitCookieSets(input)
  if (sets.length === 0) return [convert('', opts)]
  return sets.map((set) => convert(set, opts))
}

/**
 * Splits a paste into separate cookie sets, then merges every set's cookies into a
 * single output (deduped, serialised once) — the "combine into one file" mode.
 */
export function convertCombined(input: string, opts: ConvertOptions = {}): ConvertResult {
  const now = opts.now ?? Math.floor(Date.now() / 1000)
  const results = convertBatch(input, opts).filter((r) => r.ok)
  const first = results[0]
  if (!first) {
    // Nothing parsed — surface the first set's result (carries the error/issues).
    return convert(splitCookieSets(input)[0] ?? '', opts)
  }
  const detected = first.detected
  const target = opts.target ?? first.target
  const merged = dedupe({
    cookies: results.flatMap((r) => r.cookies),
    issues: [],
  })
  const issues = [...merged.issues]
  issues.push(...lossWarnings(merged.cookies, detected ?? target, target))
  return {
    ok: merged.cookies.length > 0,
    detected,
    target,
    output: serialize(target, merged.cookies),
    cookies: merged.cookies,
    issues,
    stats: computeStats(merged.cookies, now),
  }
}

function runParser(format: CookieFormat, text: string, opts: ConvertOptions): ParseResult {
  switch (format) {
    case 'netscape':
      return parseNetscape(text)
    case 'header':
      return parseHeader(text, { defaultDomain: opts.defaultDomain })
    default:
      return parseJson(text, { defaultDomain: opts.defaultDomain })
  }
}

function serialize(format: CookieFormat, cookies: Cookie[]): string {
  switch (format) {
    case 'netscape':
      return serializeNetscape(cookies)
    case 'cookie-editor':
      return serializeCookieEditor(cookies)
    case 'puppeteer':
      return serializePuppeteer(cookies)
    case 'key-value':
      return serializeKeyValue(cookies)
    case 'header':
      return serializeHeader(cookies)
  }
}

/**
 * Cookies are keyed by name+domain+path, so a file holding two entries with the
 * same key is already ambiguous. We keep the last one - matching how a browser
 * would apply them in order - and say so.
 */
function dedupe({ cookies, issues }: ParseResult): ParseResult {
  const byKey = new Map<string, Cookie>()
  for (const c of cookies) {
    byKey.set(`${c.name} ${c.domain} ${c.path}`, c)
  }

  if (byKey.size === cookies.length) return { cookies, issues }

  return {
    cookies: [...byKey.values()],
    issues: [...issues, { level: 'warning', message: 'issue.duplicates' }],
  }
}

/** Warns about attributes the chosen target format cannot represent. */
function lossWarnings(
  cookies: Cookie[],
  source: CookieFormat,
  target: CookieFormat,
): ParseIssue[] {
  const out: ParseIssue[] = []

  if (target === 'netscape' && cookies.some((c) => !c.domain)) {
    out.push({ level: 'warning', message: 'issue.missingDomain' })
  }

  if (isLossy(target) && !isLossy(source)) {
    const carriesMore = cookies.some(
      (c) => !c.session || c.path !== '/' || c.secure || c.httpOnly,
    )
    if (carriesMore) out.push({ level: 'warning', message: 'issue.lossyTarget' })
  }

  if (target === 'key-value') {
    const names = new Set(cookies.map((c) => c.name))
    if (names.size !== cookies.length) {
      out.push({ level: 'warning', message: 'issue.nameCollision' })
    }
  }

  return out
}

function byteLength(s: string): number {
  return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : s.length
}
