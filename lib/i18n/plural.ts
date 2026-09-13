import type { Locale } from './config'

/**
 * Plural forms for a countable label.
 *
 * `other` is the only required form. English and Chinese never need `few` or
 * `many`; Russian needs all four, because "4 кук" and "1 доменов" are as wrong
 * as "1 domains" is in English.
 */
export interface PluralForms {
  one?: string
  few?: string
  many?: string
  other: string
}

const CACHE = new Map<Locale, Intl.PluralRules>()

function rulesFor(locale: Locale): Intl.PluralRules {
  let rules = CACHE.get(locale)
  if (!rules) {
    rules = new Intl.PluralRules(locale)
    CACHE.set(locale, rules)
  }
  return rules
}

/** Picks the right form for `count`, falling back to `other` for any form a locale omits. */
export function plural(locale: Locale, count: number, forms: PluralForms): string {
  const category = rulesFor(locale).select(count) as keyof PluralForms
  return forms[category] ?? forms.other
}
