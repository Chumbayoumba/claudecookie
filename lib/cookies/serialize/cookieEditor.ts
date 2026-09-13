import type { Cookie } from '../types'

/**
 * Writes the Cookie-Editor / EditThisCookie export shape.
 *
 * Keys are emitted in the extension's own alphabetical order so a round-trip
 * through this tool produces a file that diffs cleanly against the original.
 */
export function serializeCookieEditor(cookies: Cookie[]): string {
  const out = cookies.map((c) => {
    const obj: Record<string, unknown> = {
      domain: c.domain,
    }
    if (!c.session && c.expirationDate !== undefined) {
      obj.expirationDate = c.expirationDate
    }
    obj.hostOnly = c.hostOnly
    obj.httpOnly = c.httpOnly
    obj.name = c.name
    obj.path = c.path
    obj.sameSite = c.sameSite
    obj.secure = c.secure
    obj.session = c.session
    obj.storeId = '0'
    obj.value = c.value
    return obj
  })

  return `${JSON.stringify(out, null, 2)}\n`
}
