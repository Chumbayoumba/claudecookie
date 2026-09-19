import { sealJson } from '@/lib/box'
import { channelRef, channelUtm } from '@/lib/analytics'
import { chunkSets } from '@/lib/check/batch'
import type { CheckResult } from '@/lib/check/types'
import type { Locale } from '@/lib/i18n/config'

/**
 * Check one paste or a batch. Live POST /check keeps at most 10 items, so a
 * longer list is split into chunks and concatenated in order.
 */
export async function postChecks(sets: string[], locale: Locale): Promise<CheckResult[]> {
  let tz: string | undefined
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    tz = undefined
  }
  const asBatch = sets.length > 1
  const chunks = asBatch ? chunkSets(sets) : [sets]
  const out: CheckResult[] = []
  for (const chunk of chunks) {
    const ref = channelRef()
    const utm = channelUtm()
    const meta = { l: locale, tz, ref, ...(utm ? { utm } : {}) }
    const box = await sealJson(
      asBatch ? { cookies: chunk, ...meta } : { cookie: chunk[0], ...meta },
    )
    const response = await fetch('/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(box),
    })
    if (!response.ok) throw new Error('check')
    if (asBatch) {
      const data = (await response.json()) as { results?: CheckResult[] }
      const rows = Array.isArray(data.results) ? data.results.slice() : []
      while (rows.length < chunk.length) {
        rows.push({ ok: false, invalidReason: 'unreachable' })
      }
      out.push(...rows.slice(0, chunk.length))
    } else {
      out.push((await response.json()) as CheckResult)
    }
  }
  return out
}
