import { describe, expect, it } from 'vitest'
import { LOCALES, localePath, matchLocale, isLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n'
import { plural } from '@/lib/i18n/plural'

describe('localePath', () => {
  it('puts English at the root and prefixes the others', () => {
    expect(localePath('en', '/')).toBe('/')
    expect(localePath('ru', '/')).toBe('/ru/')
    expect(localePath('zh', '/')).toBe('/zh/')
  })

  it('always produces a trailing slash, matching the static export', () => {
    expect(localePath('en', '/privacy')).toBe('/privacy/')
    expect(localePath('ru', '/formats/json-cookies')).toBe('/ru/formats/json-cookies/')
    expect(localePath('zh', 'privacy')).toBe('/zh/privacy/')
  })
})

describe('matchLocale', () => {
  it('picks the first supported language from the browser list', () => {
    expect(matchLocale(['ru-RU', 'ru', 'en-US'])).toBe('ru')
    expect(matchLocale(['zh-Hans-CN'])).toBe('zh')
    expect(matchLocale(['de-DE', 'fr', 'en'])).toBe('en')
  })

  it('returns null when nothing matches', () => {
    expect(matchLocale(['de-DE', 'fr-FR'])).toBeNull()
    expect(matchLocale([])).toBeNull()
  })
})

describe('isLocale', () => {
  it('rejects anything that is not one of the three', () => {
    expect(isLocale('en')).toBe(true)
    expect(isLocale('de')).toBe(false)
    expect(isLocale('../etc')).toBe(false)
  })
})

describe('stat label plurals', () => {
  it('agrees with the count in English', () => {
    const { stats } = getDictionary('en')
    expect(plural('en', 1, stats.domains)).toBe('domain')
    expect(plural('en', 2, stats.domains)).toBe('domains')
    expect(plural('en', 1, stats.cookies)).toBe('cookie')
    expect(plural('en', 0, stats.cookies)).toBe('cookies')
  })

  it('uses all three Russian forms', () => {
    const { stats } = getDictionary('ru')
    expect(plural('ru', 1, stats.cookies)).toBe('кука')
    expect(plural('ru', 2, stats.cookies)).toBe('куки')
    expect(plural('ru', 5, stats.cookies)).toBe('кук')
    expect(plural('ru', 21, stats.cookies)).toBe('кука')
    expect(plural('ru', 1, stats.domains)).toBe('домен')
    expect(plural('ru', 3, stats.domains)).toBe('домена')
    expect(plural('ru', 11, stats.domains)).toBe('доменов')
  })

  it('uses the single form in Chinese regardless of count', () => {
    const { stats } = getDictionary('zh')
    for (const n of [0, 1, 2, 5, 100]) {
      expect(plural('zh', n, stats.cookies)).toBe('条 Cookie')
    }
  })
})

describe('dictionaries', () => {
  it('translates every issue key in every locale', () => {
    const keys = Object.keys(getDictionary('en').issues)
    for (const locale of LOCALES) {
      const dict = getDictionary(locale)
      for (const key of keys) {
        const value = dict.issues[key as keyof typeof dict.issues]
        expect(value, `${locale} / ${key}`).toBeTruthy()
      }
    }
  })

  it('keeps the FAQ, steps and page sections the same length across locales', () => {
    const en = getDictionary('en')
    for (const locale of LOCALES) {
      const d = getDictionary(locale)
      expect(d.faq.items.length, locale).toBe(en.faq.items.length)
      expect(d.how.steps.length, locale).toBe(en.how.steps.length)
      expect(d.pages.netscape.fields.length, locale).toBe(en.pages.netscape.fields.length)
      expect(d.pages.json.entries.length, locale).toBe(en.pages.json.entries.length)
      expect(d.pages.privacy.sections.length, locale).toBe(en.pages.privacy.sections.length)
      expect(d.pages.privacy.summary.length, locale).toBe(en.pages.privacy.summary.length)
      expect(d.pages.api.faq.length, locale).toBe(en.pages.api.faq.length)
      expect(d.pages.api.limits.length, locale).toBe(en.pages.api.limits.length)
      expect(d.pages.api.reasons.length, locale).toBe(en.pages.api.reasons.length)
    }
  })

  it('does not mention Telegram on the public site', () => {
    for (const locale of LOCALES) {
      const dump = JSON.stringify(getDictionary(locale))
      expect(dump.toLowerCase()).not.toMatch(/telegram/)
    }
  })

  it('keeps the JSON format ids stable, since the capability table keys off them', () => {
    for (const locale of LOCALES) {
      expect(getDictionary(locale).pages.json.entries.map((e) => e.id)).toEqual([
        'cookie-editor',
        'puppeteer',
        'key-value',
        'header',
      ])
    }
  })
})
