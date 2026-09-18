/**
 * Live POST /check accepts at most MAX_BATCH items (10) per request.
 * The page splits a larger paste into chunks so 11–40 sets are not dropped.
 */
export const CHECK_CHUNK = 10

export function chunkSets<T>(items: T[], size = CHECK_CHUNK): T[][] {
  if (items.length === 0) return []
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
