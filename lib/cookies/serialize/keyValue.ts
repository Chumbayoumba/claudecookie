import type { Cookie } from '../types'

/**
 * Writes a flat `{ "name": "value" }` map, the shape `requests` and `axios`
 * take directly. Domain, path and expiry are dropped — that loss is surfaced
 * as a warning by `convert()`.
 */
export function serializeKeyValue(cookies: Cookie[]): string {
  const out: Record<string, string> = {}
  for (const c of cookies) out[c.name] = c.value
  return `${JSON.stringify(out, null, 2)}\n`
}
