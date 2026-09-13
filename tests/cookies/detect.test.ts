import { describe, expect, it } from 'vitest'
import { detectFormat, oppositeFormat } from '@/lib/cookies/detect'
import {
  COOKIE_EDITOR,
  HEADER,
  HEADER_WITH_PREFIX,
  KEY_VALUE,
  NETSCAPE_BASIC,
  NETSCAPE_HTTPONLY,
  NETSCAPE_NO_HEADER,
  NETSCAPE_SPACES,
  PUPPETEER,
} from './fixtures'

describe('detectFormat', () => {
  it('recognises a Netscape file by its header comment', () => {
    expect(detectFormat(NETSCAPE_BASIC)).toEqual({ format: 'netscape', confidence: 1 })
  })

  it('recognises a Netscape file with no header by its tab layout', () => {
    const result = detectFormat(NETSCAPE_NO_HEADER)
    expect(result.format).toBe('netscape')
    expect(result.confidence).toBeGreaterThan(0.9)
  })

  it('recognises a Netscape file whose tabs became spaces, with lower confidence', () => {
    const result = detectFormat(NETSCAPE_SPACES)
    expect(result.format).toBe('netscape')
  })

  it('recognises the #HttpOnly_ prefix as a cookie line, not a comment', () => {
    expect(detectFormat(NETSCAPE_HTTPONLY).format).toBe('netscape')
  })

  it('distinguishes Cookie-Editor from Puppeteer by their unique fields', () => {
    expect(detectFormat(COOKIE_EDITOR)).toEqual({ format: 'cookie-editor', confidence: 1 })
    expect(detectFormat(PUPPETEER).format).toBe('puppeteer')
  })

  it('recognises a flat key-value map', () => {
    expect(detectFormat(KEY_VALUE).format).toBe('key-value')
  })

  it('recognises a Cookie header, with and without the header name', () => {
    expect(detectFormat(HEADER).format).toBe('header')
    expect(detectFormat(HEADER_WITH_PREFIX).format).toBe('header')
  })

  it('unwraps exporters that nest the list under a "cookies" key', () => {
    const wrapped = JSON.stringify({ cookies: JSON.parse(COOKIE_EDITOR) })
    expect(detectFormat(wrapped).format).toBe('cookie-editor')
  })

  it('accepts a single cookie object rather than an array', () => {
    const single = JSON.stringify(JSON.parse(COOKIE_EDITOR)[0])
    expect(detectFormat(single).format).toBe('cookie-editor')
  })

  it('strips a BOM before deciding', () => {
    expect(detectFormat(`﻿${COOKIE_EDITOR}`).format).toBe('cookie-editor')
  })

  it('handles CRLF line endings', () => {
    expect(detectFormat(NETSCAPE_BASIC.replace(/\n/g, '\r\n')).format).toBe('netscape')
  })

  it('returns null for empty, whitespace and unrecognisable input', () => {
    expect(detectFormat('').format).toBeNull()
    expect(detectFormat('   \n\t ').format).toBeNull()
    expect(detectFormat('the quick brown fox jumped').format).toBeNull()
  })

  it('does not mistake malformed JSON for a valid format', () => {
    expect(detectFormat('[{"name": "a", ').format).toBeNull()
  })
})

describe('oppositeFormat', () => {
  it('flips Netscape to the default JSON dialect and every JSON dialect back', () => {
    expect(oppositeFormat('netscape')).toBe('cookie-editor')
    expect(oppositeFormat('cookie-editor')).toBe('netscape')
    expect(oppositeFormat('puppeteer')).toBe('netscape')
    expect(oppositeFormat('key-value')).toBe('netscape')
    expect(oppositeFormat('header')).toBe('netscape')
  })
})
