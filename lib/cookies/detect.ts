import { cleanInput } from './normalize'
import type { CookieFormat, DetectResult } from './types'

const NETSCAPE_HEADER = /^#\s*(Netscape\s+HTTP\s+Cookie\s+File|HTTP\s+Cookie\s+File)/im

/** `name=value; name2=value2`, optionally prefixed with a `Cookie:` header name. */
const HEADER_PAIR = /^[^=;,\s]+=[^;]*$/

const NONE = { format: null, confidence: 0 } as const

/**
 * Guesses which format the pasted text is in.
 *
 * Ordering matters: JSON is checked first because it is unambiguous, then
 * Netscape (tab-delimited, so it can never be mistaken for a header string),
 * and the loose `name=value;` header shape is the last resort.
 */
export function detectFormat(raw: string): DetectResult {
  const text = cleanInput(raw).trim()
  if (!text) return NONE

  if (text.startsWith('[') || text.startsWith('{')) {
    const fromJson = detectJson(text)
    if (fromJson) return fromJson
    // Malformed JSON — fall through; it may still be a header string or garbage.
  }

  const netscape = detectNetscape(text)
  if (netscape) return netscape

  const header = detectHeader(text)
  if (header) return header

  return NONE
}

function detectJson(text: string): DetectResult | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  return classifyJson(parsed)
}

/** Exported so the JSON parser can reuse the same classification on already-parsed data. */
export function classifyJson(parsed: unknown): DetectResult | null {
  if (Array.isArray(parsed)) return classifyCookieArray(parsed)

  if (isRecord(parsed)) {
    // Some exporters wrap the list: { "cookies": [...] }.
    const wrapped = parsed.cookies ?? parsed.Cookies
    if (Array.isArray(wrapped)) return classifyCookieArray(wrapped)

    // A single cookie object rather than an array.
    if (typeof parsed.name === 'string' && 'value' in parsed) {
      return classifyCookieArray([parsed])
    }

    // Flat `{ "session_id": "abc" }` map.
    const entries = Object.entries(parsed)
    if (entries.length > 0 && entries.every(([, v]) => isPrimitive(v))) {
      return { format: 'key-value', confidence: 0.9 }
    }
  }

  return null
}

function classifyCookieArray(items: unknown[]): DetectResult | null {
  const first = items.find(isRecord)
  // An empty array is still valid JSON cookie data, just with nothing to inspect.
  if (!first) {
    return items.length === 0 ? { format: 'cookie-editor', confidence: 0.4 } : null
  }

  if (!('name' in first)) return null

  // Fields unique to the browser-extension export.
  if ('expirationDate' in first || 'storeId' in first || 'hostOnly' in first) {
    return { format: 'cookie-editor', confidence: 1 }
  }

  // Puppeteer/Playwright use `expires` and the `None | Lax | Strict` spelling.
  if ('expires' in first) return { format: 'puppeteer', confidence: 0.95 }
  if (typeof first.sameSite === 'string' && /^(None|Lax|Strict)$/.test(first.sameSite)) {
    return { format: 'puppeteer', confidence: 0.9 }
  }

  // A bare { name, value, domain } list — Puppeteer is the closest superset.
  return { format: 'puppeteer', confidence: 0.6 }
}

function detectNetscape(text: string): DetectResult | null {
  if (NETSCAPE_HEADER.test(text)) return { format: 'netscape', confidence: 1 }

  const lines = text.split('\n')
  let tabDelimited = 0
  let whitespaceDelimited = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || (trimmed.startsWith('#') && !trimmed.startsWith('#HttpOnly_'))) continue

    const body = trimmed.replace(/^#HttpOnly_/, '')
    if (body.split('\t').length >= 7) {
      tabDelimited++
      continue
    }
    // Copy-pasting through a browser or chat often turns the tabs into spaces.
    const fields = body.split(/\s+/)
    if (fields.length >= 7 && isBoolField(fields[1]) && isBoolField(fields[3])) {
      whitespaceDelimited++
    }
  }

  if (tabDelimited > 0) return { format: 'netscape', confidence: 0.95 }
  if (whitespaceDelimited > 0) return { format: 'netscape', confidence: 0.75 }
  return null
}

function detectHeader(text: string): DetectResult | null {
  const body = text.replace(/^\s*(set-)?cookie\s*:\s*/i, '').trim()
  if (!body) return null

  const pairs = body
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)

  if (pairs.length === 0) return null
  if (!pairs.every((p) => HEADER_PAIR.test(p))) return null

  // A lone `a=b` is plausible but weak evidence; several pairs is a strong signal.
  return { format: 'header', confidence: pairs.length > 1 ? 0.85 : 0.6 }
}

/**
 * The format we convert *to* when the user has not picked one: the other side
 * of the Netscape/JSON divide.
 */
export function oppositeFormat(source: CookieFormat): CookieFormat {
  return source === 'netscape' ? 'cookie-editor' : 'netscape'
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isPrimitive(v: unknown): boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
}

function isBoolField(v: string | undefined): boolean {
  return v === 'TRUE' || v === 'FALSE' || v === 'true' || v === 'false'
}
