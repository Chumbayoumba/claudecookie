import type { Locale } from './config'
import { en, type Dictionary } from './dictionaries/en'
import { ru } from './dictionaries/ru'
import { zh } from './dictionaries/zh'

const DICTIONARIES: Record<Locale, Dictionary> = { en, ru, zh }

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale]
}

export type { Dictionary }
export * from './config'
