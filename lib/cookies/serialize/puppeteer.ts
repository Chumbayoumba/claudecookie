import { toPuppeteerSameSite } from '../normalize'
import type { Cookie } from '../types'

/**
 * Writes the shape accepted by `page.setCookie()` (Puppeteer) and
 * `context.addCookies()` (Playwright).
 *
 * Session cookies use `expires: -1`, which is Puppeteer's sentinel, and
 * `sameSite` is omitted entirely when unspecified so the browser applies its
 * own default rather than being forced into `Lax`.
 */
export function serializePuppeteer(cookies: Cookie[]): string {
  const out = cookies.map((c) => {
    const sameSite = toPuppeteerSameSite(c.sameSite)
    const obj: Record<string, unknown> = {
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.session ? -1 : (c.expirationDate ?? -1),
      httpOnly: c.httpOnly,
      secure: c.secure,
    }
    if (sameSite) obj.sameSite = sameSite
    return obj
  })

  return `${JSON.stringify(out, null, 2)}\n`
}
