import type { Cookie } from '../types'

/**
 * Writes a `Cookie:` request header value, ready to paste into
 * `curl -H 'Cookie: ...'` or Postman.
 */
export function serializeHeader(cookies: Cookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
}
