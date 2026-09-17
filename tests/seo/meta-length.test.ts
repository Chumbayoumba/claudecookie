import { describe, expect, it } from 'vitest'
import { en } from '@/lib/i18n/dictionaries/en'
import { ru } from '@/lib/i18n/dictionaries/ru'
import { zh } from '@/lib/i18n/dictionaries/zh'

const dicts = { en, ru, zh }

describe('search snippet lengths', () => {
  for (const [locale, dict] of Object.entries(dicts)) {
    for (const [page, meta] of Object.entries(dict.meta)) {
      it(`${locale}.${page} title stays in 30–65 characters`, () => {
        expect(meta.title.length).toBeGreaterThanOrEqual(30)
        expect(meta.title.length).toBeLessThanOrEqual(65)
      })

      it(`${locale}.${page} description stays in 70–180 characters`, () => {
        expect(meta.description.length).toBeGreaterThanOrEqual(70)
        expect(meta.description.length).toBeLessThanOrEqual(180)
      })
    }
  }
})
