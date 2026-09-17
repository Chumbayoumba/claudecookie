import { describe, expect, it } from 'vitest'
import {
  SAMPLE_COOKIE_EDITOR,
  SAMPLE_NETSCAPE,
  isSiteSample,
  sampleFor,
} from '@/lib/cookies/samples'

describe('isSiteSample', () => {
  it('recognises both official Sample payloads', () => {
    expect(isSiteSample(SAMPLE_NETSCAPE)).toBe(true)
    expect(isSiteSample(SAMPLE_COOKIE_EDITOR)).toBe(true)
    expect(isSiteSample(sampleFor(null))).toBe(true)
    expect(isSiteSample(sampleFor('netscape'))).toBe(true)
  })

  it('does not treat a real paste that only uses example.com as the demo', () => {
    expect(isSiteSample('sessionKey=sk-ant-real; host=example.com')).toBe(false)
    expect(isSiteSample('8f14e45fceea167a5a36dedd4bea2543')).toBe(false)
    expect(isSiteSample('cart_preview=tmp-4471')).toBe(false)
  })
})
