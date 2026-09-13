import { makeCookie, cleanInput } from '../normalize'
import type { Cookie, ParseIssue, ParseResult } from '../types'

/** Tolerant fallback for files whose tabs were flattened into spaces by copy-paste. */
const WS_LINE = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)(?:\s(.*))?$/

/**
 * Parses a Netscape `cookies.txt` file.
 *
 * Layout is seven tab-separated fields:
 *   domain, includeSubdomains, path, secure, expires, name, value
 *
 * `#HttpOnly_` in front of the domain is the curl/wget extension for http-only
 * cookies; every other `#` line is a comment.
 */
export function parseNetscape(raw: string): ParseResult {
  const issues: ParseIssue[] = []
  const cookies: Cookie[] = []
  const lines = cleanInput(raw).split('\n')

  let sawWhitespaceFallback = false

  lines.forEach((line, index) => {
    const lineNo = index + 1
    const trimmed = line.trim()
    if (!trimmed) return

    let httpOnly = false
    let body = trimmed

    if (/^#HttpOnly_/i.test(body)) {
      httpOnly = true
      body = body.replace(/^#HttpOnly_/i, '')
    } else if (body.startsWith('#')) {
      return // ordinary comment
    }

    let fields = body.split('\t')

    if (fields.length >= 7) {
      // A value can never contain a tab, but rejoining is harmless and keeps
      // any stray trailing tabs inside the value rather than dropping data.
      fields = [...fields.slice(0, 6), fields.slice(6).join('\t')]
    } else if (fields.length === 6) {
      // Trailing tab trimmed by an editor: the cookie simply has an empty value.
      fields = [...fields, '']
      issues.push({ level: 'warning', line: lineNo, message: 'issue.netscape.emptyValue' })
    } else {
      const match = WS_LINE.exec(body)
      if (!match) {
        issues.push({ level: 'error', line: lineNo, message: 'issue.netscape.badLine' })
        return
      }
      fields = [
        match[1] ?? '', match[2] ?? '', match[3] ?? '',
        match[4] ?? '', match[5] ?? '', match[6] ?? '', match[7] ?? '',
      ]
      sawWhitespaceFallback = true
    }

    const [domainRaw, includeSub, path, secure, expires, name, value] = fields as [
      string, string, string, string, string, string, string,
    ]

    if (!name) {
      issues.push({ level: 'error', line: lineNo, message: 'issue.netscape.missingName' })
      return
    }

    // The flag column is authoritative, but the leading dot is what most tools
    // actually read, so trust the dot when the two disagree.
    const flagSaysInclude = /^true$/i.test(includeSub)
    const dotSaysInclude = domainRaw.startsWith('.')
    const domain = dotSaysInclude || flagSaysInclude
      ? `.${domainRaw.replace(/^\./, '')}`
      : domainRaw

    cookies.push(
      makeCookie({
        name,
        value,
        domain: domain.toLowerCase(),
        path,
        secure: /^true$/i.test(secure),
        httpOnly,
        expires,
      }),
    )
  })

  if (sawWhitespaceFallback) {
    issues.push({ level: 'warning', message: 'issue.netscape.spacesNotTabs' })
  }
  if (cookies.length === 0 && !issues.some((i) => i.level === 'error')) {
    issues.push({ level: 'error', message: 'issue.netscape.noCookies' })
  }

  return { cookies, issues }
}
