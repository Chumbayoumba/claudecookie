import { isExpired } from './normalize'
import type { Cookie, CookieStats } from './types'

export function computeStats(cookies: Cookie[], now: number): CookieStats {
  const domains = new Set<string>()
  let expired = 0
  let session = 0
  let secure = 0
  let httpOnly = 0

  for (const c of cookies) {
    if (c.domain) domains.add(c.domain.replace(/^\./, ''))
    if (isExpired(c, now)) expired++
    if (c.session) session++
    if (c.secure) secure++
    if (c.httpOnly) httpOnly++
  }

  return { total: cookies.length, domains: domains.size, expired, session, secure, httpOnly }
}
