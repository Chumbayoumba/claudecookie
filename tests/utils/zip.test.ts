import { describe, expect, it } from 'vitest'
import { buildZip, crc32 } from '@/lib/utils/zip'

describe('crc32', () => {
  it('matches the IEEE checksums', () => {
    expect(crc32(new Uint8Array())).toBe(0)
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
})

describe('buildZip', () => {
  it('writes a store-method archive with local and central headers', () => {
    const zip = buildZip([
      { name: 'set-01-cookies.txt', text: 'one' },
      { name: 'set-02-cookies.txt', text: 'two' },
    ])
    expect(zip[0]).toBe(0x50)
    expect(zip[1]).toBe(0x4b)
    expect(zip[2]).toBe(0x03)
    expect(zip[3]).toBe(0x04)

    const asText = new TextDecoder().decode(zip)
    expect(asText).toContain('set-01-cookies.txt')
    expect(asText).toContain('set-02-cookies.txt')
    expect(asText).toContain('one')
    expect(asText).toContain('two')

    // End of central directory signature.
    const eocd = [0x50, 0x4b, 0x05, 0x06]
    const found = zip.findIndex(
      (_, i) =>
        zip[i] === eocd[0] && zip[i + 1] === eocd[1] && zip[i + 2] === eocd[2] && zip[i + 3] === eocd[3],
    )
    expect(found).toBeGreaterThan(0)
  })
})
