import { describe, expect, it } from 'vitest'
import { parseHeader } from '@/lib/cookies/parse/header'
import { parseJson } from '@/lib/cookies/parse/json'
import { parseNetscape } from '@/lib/cookies/parse/netscape'
import { normalizeExpires, normalizeSameSite } from '@/lib/cookies/normalize'
import {
  COOKIE_EDITOR,
  FUTURE,
  HEADER,
  HEADER_WITH_PREFIX,
  JWT_VALUE,
  KEY_VALUE,
  NETSCAPE_BASIC,
  NETSCAPE_HTTPONLY,
  NETSCAPE_SPACES,
  PUPPETEER,
} from './fixtures'

describe('normalizeExpires', () => {
  it('treats every "no expiry" spelling as a session cookie', () => {
    for (const raw of [undefined, null, '', 0, '0', -1, '-1']) {
      expect(normalizeExpires(raw), `input: ${String(raw)}`).toEqual({ session: true })
    }
  })

  it('keeps unix seconds as-is', () => {
    expect(normalizeExpires(FUTURE)).toEqual({ expirationDate: FUTURE, session: false })
  })

  it('converts millisecond timestamps down to seconds', () => {
    expect(normalizeExpires(FUTURE * 1000)).toEqual({ expirationDate: FUTURE, session: false })
  })

  it('rounds the fractional expirationDate that Cookie-Editor emits', () => {
    expect(normalizeExpires(FUTURE + 0.7382)).toEqual({
      expirationDate: FUTURE + 1,
      session: false,
    })
  })

  it('falls back to a session cookie for values that are not numbers', () => {
    expect(normalizeExpires('not-a-date')).toEqual({ session: true })
  })
})

describe('normalizeSameSite', () => {
  it('maps both vocabularies onto the canonical one', () => {
    expect(normalizeSameSite('None')).toBe('no_restriction')
    expect(normalizeSameSite('no_restriction')).toBe('no_restriction')
    expect(normalizeSameSite('Lax')).toBe('lax')
    expect(normalizeSameSite('strict')).toBe('strict')
    expect(normalizeSameSite(undefined)).toBe('unspecified')
    expect(normalizeSameSite('nonsense')).toBe('unspecified')
  })
})

describe('parseNetscape', () => {
  it('reads all seven fields', () => {
    const { cookies } = parseNetscape(NETSCAPE_BASIC)
    expect(cookies).toHaveLength(3)

    expect(cookies[0]).toMatchObject({
      name: 'session_id',
      value: 'abc123',
      domain: '.example.com',
      path: '/',
      secure: false,
      hostOnly: false,
      session: false,
      expirationDate: FUTURE,
    })

    expect(cookies[1]).toMatchObject({
      name: 'csrf',
      domain: 'example.com',
      path: '/app',
      secure: true,
      hostOnly: true,
    })
  })

  it('treats an expiry of 0 as a session cookie', () => {
    const { cookies } = parseNetscape(NETSCAPE_BASIC)
    expect(cookies[2]).toMatchObject({ name: 'temp', session: true })
    expect(cookies[2]?.expirationDate).toBeUndefined()
  })

  it('reads the #HttpOnly_ prefix and does not treat it as a comment', () => {
    const { cookies } = parseNetscape(NETSCAPE_HTTPONLY)
    expect(cookies).toHaveLength(2)
    expect(cookies[0]).toMatchObject({
      name: 'auth_token',
      domain: '.example.com',
      httpOnly: true,
    })
    expect(cookies[1]?.httpOnly).toBe(false)
  })

  it('falls back to whitespace splitting and warns about it', () => {
    const { cookies, issues } = parseNetscape(NETSCAPE_SPACES)
    expect(cookies).toHaveLength(2)
    expect(issues.some((i) => i.message === 'issue.netscape.spacesNotTabs')).toBe(true)
  })

  it('keeps spaces inside the value when falling back to whitespace splitting', () => {
    const { cookies } = parseNetscape(NETSCAPE_SPACES)
    expect(cookies[1]).toMatchObject({ name: 'greeting', value: 'hello world' })
  })

  it('preserves values containing = ; and quotes', () => {
    const tricky = `.example.com\tTRUE\t/\tFALSE\t${FUTURE}\tblob\ta=b;c="d"`
    const { cookies } = parseNetscape(tricky)
    expect(cookies[0]?.value).toBe('a=b;c="d"')
  })

  it('preserves a JWT value untouched', () => {
    const line = `.example.com\tTRUE\t/\tFALSE\t${FUTURE}\ttoken\t${JWT_VALUE}`
    expect(parseNetscape(line).cookies[0]?.value).toBe(JWT_VALUE)
  })

  it('accepts an empty value when the trailing tab was trimmed', () => {
    const { cookies, issues } = parseNetscape(`.example.com\tTRUE\t/\tFALSE\t0\tempty`)
    expect(cookies[0]).toMatchObject({ name: 'empty', value: '' })
    expect(issues.some((i) => i.message === 'issue.netscape.emptyValue')).toBe(true)
  })

  it('reports the line number of a line it cannot read', () => {
    const input = ['# comment', 'total garbage here', NETSCAPE_BASIC].join('\n')
    const { issues } = parseNetscape(input)
    expect(issues.some((i) => i.level === 'error' && i.line === 2)).toBe(true)
  })

  it('trusts the leading dot when it disagrees with the flag column', () => {
    const { cookies } = parseNetscape(`.example.com\tFALSE\t/\tFALSE\t0\tn\tv`)
    expect(cookies[0]).toMatchObject({ domain: '.example.com', hostOnly: false })
  })

  it('adds the leading dot when only the flag column says to include subdomains', () => {
    const { cookies } = parseNetscape(`example.com\tTRUE\t/\tFALSE\t0\tn\tv`)
    expect(cookies[0]).toMatchObject({ domain: '.example.com', hostOnly: false })
  })
})

describe('parseJson', () => {
  it('reads the Cookie-Editor shape', () => {
    const { cookies } = parseJson(COOKIE_EDITOR)
    expect(cookies).toHaveLength(2)
    expect(cookies[0]).toMatchObject({
      name: 'session_id',
      value: 'abc123',
      domain: '.example.com',
      httpOnly: true,
      secure: true,
      sameSite: 'no_restriction',
      session: false,
      expirationDate: FUTURE,
      hostOnly: false,
    })
    expect(cookies[1]).toMatchObject({ name: 'temp', session: true, sameSite: 'lax' })
  })

  it('reads the Puppeteer shape, including -1 as a session cookie', () => {
    const { cookies } = parseJson(PUPPETEER)
    expect(cookies[0]).toMatchObject({ expirationDate: FUTURE, sameSite: 'no_restriction' })
    expect(cookies[1]).toMatchObject({ session: true, sameSite: 'lax' })
  })

  it('reads a flat key-value map, applying the default domain', () => {
    const { cookies } = parseJson(KEY_VALUE, { defaultDomain: 'example.com' })
    expect(cookies).toHaveLength(2)
    expect(cookies[0]).toMatchObject({
      name: 'session_id',
      value: 'abc123',
      domain: 'example.com',
      session: true,
    })
  })

  it('coerces non-string values rather than dropping them', () => {
    const { cookies } = parseJson('{"count": 42, "enabled": true}')
    expect(cookies[0]?.value).toBe('42')
    expect(cookies[1]?.value).toBe('true')
  })

  it('unwraps a list nested under a "cookies" key', () => {
    const wrapped = JSON.stringify({ cookies: JSON.parse(COOKIE_EDITOR) })
    expect(parseJson(wrapped).cookies).toHaveLength(2)
  })

  it('reports the line number of a JSON syntax error', () => {
    const broken = '[\n  {\n    "name": "a",,\n  }\n]'
    const { issues } = parseJson(broken)
    expect(issues[0]?.level).toBe('error')
    expect(issues[0]?.message).toBe('issue.json.invalid')
    expect(issues[0]?.line).toBeGreaterThan(1)
  })

  it('skips entries missing a name and keeps the rest', () => {
    const input = '[{"value":"orphan"},{"name":"good","value":"v"}]'
    const { cookies, issues } = parseJson(input)
    expect(cookies).toHaveLength(1)
    expect(cookies[0]?.name).toBe('good')
    expect(issues.some((i) => i.message === 'issue.json.missingName')).toBe(true)
  })

  it('normalises a full URL pasted into the domain field', () => {
    const input = '[{"name":"n","value":"v","domain":"https://Example.com:8443/path"}]'
    expect(parseJson(input).cookies[0]?.domain).toBe('example.com')
  })

  it('derives the leading dot from hostOnly: false', () => {
    const input = '[{"name":"n","value":"v","domain":"example.com","hostOnly":false}]'
    expect(parseJson(input).cookies[0]?.domain).toBe('.example.com')
  })
})

describe('parseHeader', () => {
  it('reads a header value with and without the header name', () => {
    for (const input of [HEADER, HEADER_WITH_PREFIX]) {
      const { cookies } = parseHeader(input, { defaultDomain: 'example.com' })
      expect(cookies).toHaveLength(2)
      expect(cookies[0]).toMatchObject({
        name: 'session_id',
        value: 'abc123',
        domain: 'example.com',
        session: true,
      })
    }
  })

  it('splits on the first = only, so base64 and JWT values survive', () => {
    const { cookies } = parseHeader(`token=${JWT_VALUE}; padded=YWJjMTIz==`)
    expect(cookies[0]?.value).toBe(JWT_VALUE)
    expect(cookies[1]?.value).toBe('YWJjMTIz==')
  })

  it('tolerates a trailing semicolon and extra whitespace', () => {
    const { cookies } = parseHeader('  a=1 ;  b=2 ;  ')
    expect(cookies).toHaveLength(2)
  })
})
