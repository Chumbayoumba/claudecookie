import { describe, expect, it } from 'vitest'
import { CHECK_CHUNK, chunkSets } from '@/lib/check/batch'

describe('chunkSets', () => {
  it('keeps a short list as one chunk', () => {
    expect(chunkSets(['a', 'b', 'c'])).toEqual([['a', 'b', 'c']])
  })

  it('splits at the live /check cap so a 40-set paste is not truncated', () => {
    const items = Array.from({ length: 40 }, (_, i) => `set-${i}`)
    const chunks = chunkSets(items)
    expect(CHECK_CHUNK).toBe(10)
    expect(chunks).toHaveLength(4)
    expect(chunks.every((c) => c.length === 10)).toBe(true)
    expect(chunks.flat()).toEqual(items)
  })
})
