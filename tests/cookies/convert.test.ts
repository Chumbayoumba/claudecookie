import { describe, expect, it } from 'vitest'
import { convert, convertBatch, joinCookieSets } from '@/lib/cookies'
import { ALL_FORMATS, MAX_INPUT_BYTES } from '@/lib/cookies/types'
import {
  COOKIE_EDITOR,
  FUTURE,
  HEADER,
  JWT_VALUE,
  KEY_VALUE,
  NETSCAPE_BASIC,
  NETSCAPE_HTTPONLY,
  NOW,
  PAST,
  PUPPETEER,
} from './fixtures'

const opts = { now: NOW }

describe('convert: auto direction', () => {
  it('turns Netscape into Cookie-Editor JSON by default', () => {
    const r = convert(NETSCAPE_BASIC, opts)
    expect(r.ok).toBe(true)
    expect(r.detected).toBe('netscape')
    expect(r.target).toBe('cookie-editor')
    expect(JSON.parse(r.output)).toHaveLength(3)
  })

  it('turns every JSON dialect back into Netscape by default', () => {
    for (const input of [COOKIE_EDITOR, PUPPETEER, KEY_VALUE, HEADER]) {
      const r = convert(input, opts)
      expect(r.ok, `input: ${input.slice(0, 30)}`).toBe(true)
      expect(r.target).toBe('netscape')
      expect(r.output).toContain('# Netscape HTTP Cookie File')
    }
  })

  it('honours an explicit target over the default', () => {
    const r = convert(NETSCAPE_BASIC, { ...opts, target: 'puppeteer' })
    expect(r.target).toBe('puppeteer')
    expect(JSON.parse(r.output)[0]).toHaveProperty('expires')
  })

  it('honours an explicit source over detection', () => {
    const r = convert(HEADER, { ...opts, source: 'header', defaultDomain: 'example.com' })
    expect(r.detected).toBe('header')
  })
})

describe('convert: round trips', () => {
  it('survives Netscape -> Cookie-Editor -> Netscape unchanged', () => {
    const json = convert(NETSCAPE_BASIC, opts).output
    const back = convert(json, { ...opts, target: 'netscape' }).output
    expect(back).toBe(convert(NETSCAPE_BASIC, { ...opts, target: 'netscape' }).output)
  })

  it('survives Netscape -> Puppeteer -> Netscape unchanged', () => {
    const json = convert(NETSCAPE_BASIC, { ...opts, target: 'puppeteer' }).output
    const back = convert(json, { ...opts, target: 'netscape' }).output
    expect(back).toBe(convert(NETSCAPE_BASIC, { ...opts, target: 'netscape' }).output)
  })

  it('preserves the http-only flag across a round trip', () => {
    const json = convert(NETSCAPE_HTTPONLY, opts).output
    expect(JSON.parse(json)[0].httpOnly).toBe(true)

    const back = convert(json, { ...opts, target: 'netscape' }).output
    expect(back).toContain('#HttpOnly_.example.com')
  })

  it('preserves sameSite across both JSON vocabularies', () => {
    const puppeteer = convert(COOKIE_EDITOR, { ...opts, target: 'puppeteer' }).output
    expect(JSON.parse(puppeteer)[0].sameSite).toBe('None')

    const back = convert(puppeteer, { ...opts, target: 'cookie-editor' }).output
    expect(JSON.parse(back)[0].sameSite).toBe('no_restriction')
  })

  it('omits sameSite for Puppeteer when it is unspecified', () => {
    const netscape = `.example.com\tTRUE\t/\tFALSE\t${FUTURE}\tn\tv`
    const out = JSON.parse(convert(netscape, { ...opts, target: 'puppeteer' }).output)
    expect(out[0]).not.toHaveProperty('sameSite')
  })

  it('preserves a JWT value through every target format', () => {
    const input = `.example.com\tTRUE\t/\tFALSE\t${FUTURE}\ttoken\t${JWT_VALUE}`
    for (const target of ['cookie-editor', 'puppeteer', 'key-value', 'header'] as const) {
      const out = convert(input, { ...opts, target }).output
      expect(out, `target: ${target}`).toContain(JWT_VALUE)
    }
  })

  it('round-trips millisecond expiries down to seconds and back', () => {
    const input = JSON.stringify([
      { name: 'n', value: 'v', domain: '.example.com', expirationDate: FUTURE * 1000 },
    ])
    const netscape = convert(input, { ...opts, target: 'netscape' }).output
    expect(netscape).toContain(`\t${FUTURE}\t`)
  })
})

describe('convert: statistics', () => {
  it('counts cookies, distinct domains, expired and session cookies', () => {
    const input = [
      `.example.com\tTRUE\t/\tFALSE\t${FUTURE}\ta\t1`,
      `example.com\tFALSE\t/\tTRUE\t${PAST}\tb\t2`,
      `.other.com\tTRUE\t/\tFALSE\t0\tc\t3`,
    ].join('\n')

    const { stats } = convert(input, opts)
    expect(stats).toMatchObject({
      total: 3,
      domains: 2, // example.com counted once despite the leading-dot variant
      expired: 1,
      session: 1,
      secure: 1,
    })
  })
})

describe('convert: warnings and errors', () => {
  it('refuses input it cannot recognise', () => {
    const r = convert('the quick brown fox', opts)
    expect(r.ok).toBe(false)
    expect(r.issues[0]).toMatchObject({ level: 'error', message: 'issue.unknownFormat' })
  })

  it('returns a clean empty result for empty input rather than an error', () => {
    const r = convert('   ', opts)
    expect(r.ok).toBe(false)
    expect(r.issues).toHaveLength(0)
    expect(r.output).toBe('')
  })

  it('rejects input above the size limit', () => {
    const huge = `x`.repeat(MAX_INPUT_BYTES + 1)
    expect(convert(huge, opts).issues[0]?.message).toBe('issue.tooLarge')
  })

  it('drops duplicate name+domain+path entries and says so', () => {
    const input = [
      `.example.com\tTRUE\t/\tFALSE\t${FUTURE}\tdup\tfirst`,
      `.example.com\tTRUE\t/\tFALSE\t${FUTURE}\tdup\tsecond`,
    ].join('\n')

    const r = convert(input, opts)
    expect(r.cookies).toHaveLength(1)
    expect(r.cookies[0]?.value).toBe('second')
    expect(r.issues.some((i) => i.message === 'issue.duplicates')).toBe(true)
  })

  it('keeps same-name cookies that differ by domain or path', () => {
    const input = [
      `.example.com\tTRUE\t/\tFALSE\t${FUTURE}\tsid\ta`,
      `.other.com\tTRUE\t/\tFALSE\t${FUTURE}\tsid\tb`,
      `.example.com\tTRUE\t/app\tFALSE\t${FUTURE}\tsid\tc`,
    ].join('\n')
    expect(convert(input, opts).cookies).toHaveLength(3)
  })

  it('warns when exporting to Netscape without a domain', () => {
    const r = convert(HEADER, { ...opts, target: 'netscape' })
    expect(r.issues.some((i) => i.message === 'issue.missingDomain')).toBe(true)
  })

  it('does not warn about a missing domain once one is supplied', () => {
    const r = convert(HEADER, { ...opts, target: 'netscape', defaultDomain: 'example.com' })
    expect(r.issues.some((i) => i.message === 'issue.missingDomain')).toBe(false)
    expect(r.output).toContain('example.com')
  })

  it('warns that key-value and header targets drop attributes', () => {
    for (const target of ['key-value', 'header'] as const) {
      const r = convert(NETSCAPE_BASIC, { ...opts, target })
      expect(r.issues.some((i) => i.message === 'issue.lossyTarget'), target).toBe(true)
    }
  })

  it('warns when a key-value export would collapse two different cookies', () => {
    const input = [
      `.example.com\tTRUE\t/\tFALSE\t0\tsid\ta`,
      `.other.com\tTRUE\t/\tFALSE\t0\tsid\tb`,
    ].join('\n')
    const r = convert(input, { ...opts, target: 'key-value' })
    expect(r.issues.some((i) => i.message === 'issue.nameCollision')).toBe(true)
  })
})

describe('convert: output shape', () => {
  it('writes Cookie-Editor keys in the extension order', () => {
    const out = JSON.parse(convert(NETSCAPE_BASIC, opts).output)
    expect(Object.keys(out[0])).toEqual([
      'domain', 'expirationDate', 'hostOnly', 'httpOnly', 'name',
      'path', 'sameSite', 'secure', 'session', 'storeId', 'value',
    ])
  })

  it('omits expirationDate and sets session for session cookies', () => {
    const out = JSON.parse(convert(NETSCAPE_BASIC, opts).output)
    const temp = out.find((c: { name: string }) => c.name === 'temp')
    expect(temp).not.toHaveProperty('expirationDate')
    expect(temp.session).toBe(true)
  })

  it('writes a Netscape file ending in a newline with tab-separated fields', () => {
    const out = convert(COOKIE_EDITOR, opts).output
    expect(out.endsWith('\n')).toBe(true)
    const line = out.split('\n').find((l) => l.includes('session_id'))
    expect(line?.split('\t')).toHaveLength(7)
  })

  it('writes a header string as name=value pairs joined by "; "', () => {
    expect(convert(KEY_VALUE, { ...opts, target: 'header' }).output).toBe(
      'session_id=abc123; csrf=xyz789',
    )
  })
})

describe('convert: claude-market Netscape dump', () => {
  const dump = [
    '# Netscape HTTP Cookie File',
    '# generated by claude-market validator',
    `.claude.ai\tTRUE\t/\tTRUE\t9999999999\t_fbp\tfb.1.1`,
    `.claude.ai\tTRUE\t/\tTRUE\t9999999999\tg_state\t{"i_l":0,"i_e":{"x":1}}`,
    `.claude.ai\tTRUE\t/\tTRUE\t9999999999\tsessionKey\tsk-ant-sid02-TEST`,
    `.claude.ai\tTRUE\t/\tTRUE\t9999999999\tsessionKeyV3\tsk-ant-sid02-TEST`,
  ].join('\n')

  it('converts the dump into every target without dropping g_state', () => {
    for (const target of ALL_FORMATS) {
      const r = convert(dump, { ...opts, target })
      expect(r.ok, target).toBe(true)
      expect(r.stats.total).toBe(4)
      expect(r.output).toContain('g_state')
      expect(r.output).toContain('sessionKey')
    }
  })

  it('converts ten joined dumps as ten separate sets', () => {
    const results = convertBatch(joinCookieSets(Array.from({ length: 10 }, () => dump)), {
      ...opts,
      target: 'cookie-editor',
    })
    expect(results).toHaveLength(10)
    expect(results.every((r) => r.ok && r.stats.total === 4)).toBe(true)
  })
})
