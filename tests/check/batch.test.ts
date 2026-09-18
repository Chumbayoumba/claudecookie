import { describe, expect, it } from 'vitest'
import { CHECK_CHUNK, chunkSets } from '@/lib/check/batch'

describe('chunkSets', () => {
  it('keeps a short list as one chunk', () => {
    expect(chunkSets(['a', 'b', 'c'])).toEqual([['a', 'b', 'c']])
  })

  it('splits at the live /check cap so a 20-set paste is not truncated', () => {
    const items = Array.from({ length: 20 }, (_, i) => `set-${i}`)
    const chunks = chunkSets(items)
    expect(CHECK_CHUNK).toBe(10)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(10)
    expect(chunks[1]).toHaveLength(10)
    expect(chunks.flat()).toEqual(items)
  })
})
