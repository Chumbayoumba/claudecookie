import { makeCookie, normalizeDomain, normalizeSameSite } from '../normalize'
import type { Cookie, ParseIssue, ParseResult } from '../types'

interface JsonParseOptions {
  defaultDomain?: string
}

/**
 * Parses every JSON cookie dialect we support with one tolerant reader.
 *
 * Rather than branching on the detected dialect, we read the union of all known
 * field spellings — Cookie-Editor's `expirationDate`, Puppeteer's `expires`,
 * and the casing variations that show up in hand-edited files.
 */
export function parseJson(raw: string, opts: JsonParseOptions = {}): ParseResult {
  const issues: ParseIssue[] = []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    return {
      cookies: [],
      issues: [{
        level: 'error',
        line: jsonErrorLine(raw, err),
        message: 'issue.json.invalid',
      }],
    }
  }

  const items = unwrap(parsed)

  if (items === null) {
    return { cookies: [], issues: [{ level: 'error', message: 'issue.json.unsupportedShape' }] }
  }

  // Flat `{ "session_id": "abc" }` map: keys are names, values are values,
  // and there is no domain anywhere in the payload.
  if (!Array.isArray(items)) {
    const cookies: Cookie[] = []
    for (const [name, value] of Object.entries(items)) {
      cookies.push(
        makeCookie({
          name,
          value: stringify(value),
          domain: normalizeDomain(opts.defaultDomain),
          path: '/',
          session: true,
        }),
      )
    }
    if (cookies.length === 0) issues.push({ level: 'error', message: 'issue.json.empty' })
    return { cookies, issues }
  }

  const cookies: Cookie[] = []

  items.forEach((item, index) => {
    if (!isRecord(item)) {
      issues.push({ level: 'error', message: 'issue.json.notAnObject', line: index + 1 })
      return
    }

    const name = pick(item, 'name', 'Name', 'key')
    if (typeof name !== 'string' || !name) {
      issues.push({ level: 'error', message: 'issue.json.missingName', line: index + 1 })
      return
    }

    const rawValue = pick(item, 'value', 'Value')
    if (rawValue === undefined) {
      issues.push({ level: 'error', message: 'issue.json.missingValue', line: index + 1 })
      return
    }

    const hostOnlyRaw = pick(item, 'hostOnly', 'hostonly')
    const domainRaw = pick(item, 'domain', 'Domain')
    const domain = normalizeDomain(
      domainRaw ?? opts.defaultDomain,
      typeof hostOnlyRaw === 'boolean' ? !hostOnlyRaw : undefined,
    )

    cookies.push(
      makeCookie({
        name,
        value: stringify(rawValue),
        domain,
        path: asString(pick(item, 'path', 'Path')) ?? '/',
        secure: asBool(pick(item, 'secure', 'Secure')),
        httpOnly: asBool(pick(item, 'httpOnly', 'httponly', 'HttpOnly', 'http_only')),
        hostOnly: typeof hostOnlyRaw === 'boolean' ? hostOnlyRaw : undefined,
        sameSite: normalizeSameSite(pick(item, 'sameSite', 'samesite', 'SameSite')),
        expires: pick(item, 'expirationDate', 'expires', 'expiry', 'expiration_date', 'Expires'),
        session: asBoolOrUndefined(pick(item, 'session', 'Session')),
      }),
    )
  })

  if (cookies.length === 0 && !issues.some((i) => i.level === 'error')) {
    issues.push({ level: 'error', message: 'issue.json.empty' })
  }

  return { cookies, issues }
}

/** Reduces the supported top-level shapes to either a list of cookies or a flat map. */
function unwrap(parsed: unknown): unknown[] | Record<string, unknown> | null {
  if (Array.isArray(parsed)) return parsed

  if (isRecord(parsed)) {
    const wrapped = parsed.cookies ?? parsed.Cookies
    if (Array.isArray(wrapped)) return wrapped

    if (typeof parsed.name === 'string' && 'value' in parsed) return [parsed]

    const entries = Object.entries(parsed)
    if (entries.length > 0 && entries.every(([, v]) => isPrimitive(v))) return parsed
    if (entries.length === 0) return []
  }

  return null
}

/** Turns a `JSON.parse` position offset into a 1-based line number for the UI. */
function jsonErrorLine(raw: string, err: unknown): number | undefined {
  const message = err instanceof Error ? err.message : ''
  const match = /position\s+(\d+)/i.exec(message)
  if (!match?.[1]) return undefined
  const offset = Number(match[1])
  if (!Number.isFinite(offset)) return undefined
  return raw.slice(0, offset).split('\n').length
}

function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return undefined
}

function stringify(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v) ?? ''
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v : undefined
}

function asBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'string') return /^(true|1|yes)$/i.test(v.trim())
  return false
}

function asBoolOrUndefined(v: unknown): boolean | undefined {
  return v === undefined ? undefined : asBool(v)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isPrimitive(v: unknown): boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
}
