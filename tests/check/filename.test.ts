import { describe, expect, it } from 'vitest'
import { cookieFileSlug, uniqueFilename, validCookieFiles } from '@/lib/check/filename'

describe('cookieFileSlug', () => {
  it('uses the email local-part and a shortened plan', () => {
    expect(cookieFileSlug('Andreas@example.com', 'Claude Max')).toBe('andreas-max-valid')
  })

  it('falls back when email or plan is missing', () => {
    expect(cookieFileSlug(null, 'Pro')).toBe('account-pro-valid')
    expect(cookieFileSlug('solo', null)).toBe('solo-plan-valid')
  })

  it('strips characters that cannot live in a filename', () => {
    expect(cookieFileSlug('a/b:c', 'Claude Pro')).toBe('a-b-c-pro-valid')
  })
})

describe('uniqueFilename', () => {
  it('numbers collisions', () => {
    const seen = new Map<string, number>()
    expect(uniqueFilename(seen, 'andreas-max-valid')).toBe('andreas-max-valid.txt')
    expect(uniqueFilename(seen, 'andreas-max-valid')).toBe('andreas-max-valid-2.txt')
  })
})

describe('validCookieFiles', () => {
  it('names each file from email and plan', () => {
    const files = validCookieFiles([
      { raw: 'one', email: 'ada@example.com', plan: 'Claude Pro' },
      { raw: 'two', email: 'ada@example.com', plan: 'Claude Pro' },
    ])
    expect(files.map((f) => f.name)).toEqual(['ada-pro-valid.txt', 'ada-pro-valid-2.txt'])
    expect(files.map((f) => f.text)).toEqual(['one', 'two'])
  })
})
