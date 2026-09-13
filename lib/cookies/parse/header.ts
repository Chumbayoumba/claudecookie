import { makeCookie, normalizeDomain, cleanInput } from '../normalize'
import type { Cookie, ParseIssue, ParseResult } from '../types'

interface HeaderParseOptions {
  defaultDomain?: string
}

/**
 * Parses a `Cookie:` request header value — `name=value; name2=value2`.
 *
 * This shape carries no domain, path or expiry, so every cookie comes out as a
 * session cookie and the domain has to be supplied by the caller.
 */
export function parseHeader(raw: string, opts: HeaderParseOptions = {}): ParseResult {
  const issues: ParseIssue[] = []
  const cookies: Cookie[] = []

  const body = cleanInput(raw)
    .replace(/^\s*(set-)?cookie\s*:\s*/i, '')
    .trim()

  if (!body) {
    return { cookies, issues: [{ level: 'error', message: 'issue.header.empty' }] }
  }

  const domain = normalizeDomain(opts.defaultDomain)

  for (const pair of body.split(';')) {
    const chunk = pair.trim()
    if (!chunk) continue

    const eq = chunk.indexOf('=')
    if (eq <= 0) {
      issues.push({ level: 'warning', message: 'issue.header.badPair' })
      continue
    }

    const name = chunk.slice(0, eq).trim()
    // Only the first `=` separates; the rest belongs to the value (base64, JWT).
    const value = chunk.slice(eq + 1).trim()

    if (!name) {
      issues.push({ level: 'warning', message: 'issue.header.badPair' })
      continue
    }

    cookies.push(makeCookie({ name, value, domain, path: '/', session: true }))
  }

  if (cookies.length === 0 && !issues.some((i) => i.level === 'error')) {
    issues.push({ level: 'error', message: 'issue.header.empty' })
  }

  return { cookies, issues }
}
