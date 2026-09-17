import { describe, expect, it } from 'vitest'
import { convertBatch, convertCombined } from '@/lib/cookies'
import { MAX_SETS, splitCookieSets } from '@/lib/cookies/split'
import { COOKIE_EDITOR, HEADER, NETSCAPE_BASIC, NETSCAPE_HTTPONLY, NETSCAPE_NO_HEADER, PUPPETEER } from './fixtures'

describe('splitCookieSets', () => {
  it('returns nothing for empty input', () => {
    expect(splitCookieSets('')).toEqual([])
    expect(splitCookieSets('   \n  ')).toEqual([])
  })

  it('keeps a single JSON export as one set', () => {
    expect(splitCookieSets(COOKIE_EDITOR)).toHaveLength(1)
    expect(splitCookieSets(PUPPETEER)).toHaveLength(1)
  })

  it('splits several concatenated JSON exports', () => {
    expect(splitCookieSets(`${COOKIE_EDITOR}\n${COOKIE_EDITOR}`)).toHaveLength(2)
    expect(splitCookieSets(`${COOKIE_EDITOR}${PUPPETEER}`)).toHaveLength(2)
    expect(splitCookieSets(`${COOKIE_EDITOR}\n\n${PUPPETEER}\n\n${COOKIE_EDITOR}`)).toHaveLength(3)
  })

  it('keeps a single cookies.txt as one set, even with internal blank lines', () => {
    expect(splitCookieSets(NETSCAPE_BASIC)).toHaveLength(1)
    expect(splitCookieSets(NETSCAPE_HTTPONLY)).toHaveLength(1)
  })

  it('splits several cookies.txt files that repeat the Netscape header', () => {
    expect(splitCookieSets(`${NETSCAPE_HTTPONLY}\n\n${NETSCAPE_BASIC}`)).toHaveLength(2)
  })

  it('splits repeated headerless dumps by repeated cookie name (any separator)', () => {
    // Same account pasted 3× — names restart each time.
    expect(splitCookieSets(`${NETSCAPE_NO_HEADER}\n${NETSCAPE_NO_HEADER}\n${NETSCAPE_NO_HEADER}`)).toHaveLength(3)
    expect(splitCookieSets(`${NETSCAPE_NO_HEADER}\n\n${NETSCAPE_NO_HEADER}`)).toHaveLength(2)
  })

  it('splits dumps glued together with no separator', () => {
    // The second line starts immediately after the first value, no newline.
    expect(splitCookieSets(`${NETSCAPE_NO_HEADER}${NETSCAPE_NO_HEADER}`)).toHaveLength(2)
  })

  it('splits the same full dump repeated 3× (headed)', () => {
    expect(splitCookieSets([NETSCAPE_BASIC, NETSCAPE_BASIC, NETSCAPE_BASIC].join('\n\n'))).toHaveLength(3)
  })

  it('keeps a single header string as one set', () => {
    expect(splitCookieSets(HEADER)).toHaveLength(1)
  })

  it('splits multiple header strings, one per line', () => {
    expect(splitCookieSets(`${HEADER}\n${HEADER}\n${HEADER}`)).toHaveLength(3)
  })

  it('splits blank-line-separated mixed blocks', () => {
    expect(splitCookieSets(`${NETSCAPE_NO_HEADER}\n\n${HEADER}`)).toHaveLength(2)
  })

  it('never returns more than MAX_SETS', () => {
    const many = Array.from({ length: 30 }, () => HEADER).join('\n')
    expect(splitCookieSets(many)).toHaveLength(MAX_SETS)
  })
})

describe('convertBatch / convertCombined', () => {
  it('converts each set independently', () => {
    const results = convertBatch(`${COOKIE_EDITOR}\n${PUPPETEER}`)
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.ok)).toBe(true)
  })

  it('single set behaves like convert()', () => {
    const results = convertBatch(COOKIE_EDITOR)
    expect(results).toHaveLength(1)
    expect(results[0]?.ok).toBe(true)
  })

  it('combines all sets into one output', () => {
    const combined = convertCombined(`${COOKIE_EDITOR}\n${PUPPETEER}`)
    expect(combined.ok).toBe(true)
    // Both exports carry session_id + temp; merged & deduped by name+domain+path.
    expect(combined.cookies.length).toBeGreaterThanOrEqual(2)
  })
})
