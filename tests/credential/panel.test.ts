import { describe, expect, it } from 'vitest'
import { canStartGenerate, shouldMountTurnstile } from '@/lib/credential/panel'

describe('shouldMountTurnstile', () => {
  it('shows the widget only while waiting for a captcha', () => {
    expect(shouldMountTurnstile(false, null)).toBe(true)
  })

  it('hides the widget during generate so it cannot remount mid-request', () => {
    expect(shouldMountTurnstile(true, null)).toBe(false)
  })

  it('stays hidden after an error until the user clicks Generate again', () => {
    expect(shouldMountTurnstile(false, 'Claude rejected this session.')).toBe(false)
    expect(shouldMountTurnstile(true, 'Claude rejected this session.')).toBe(false)
  })
})

describe('canStartGenerate', () => {
  it('starts only while a generate panel is open and unlocked', () => {
    expect(canStartGenerate(0, false)).toBe(true)
    expect(canStartGenerate(2, false)).toBe(true)
  })

  it('ignores a late captcha token after the attempt ended', () => {
    expect(canStartGenerate(null, false)).toBe(false)
    expect(canStartGenerate(0, true)).toBe(false)
    expect(canStartGenerate(null, true)).toBe(false)
  })
})
