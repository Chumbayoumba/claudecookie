export const LOCALES = ['en', 'ru', 'zh'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

export const SITE_URL = 'https://claudecookie.com'

/** Cookie that pins a manual language choice. It always wins over geo detection. */
export const LOCALE_COOKIE = 'cclang'
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

interface LocaleMeta {
  /** Name shown in the language switcher, written in that language. */
  name: string
  /** BCP 47 tag for the `lang` attribute and `hreflang`. */
  tag: string
  dir: 'ltr' | 'rtl'
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { name: 'English', tag: 'en', dir: 'ltr' },
  ru: { name: 'Русский', tag: 'ru', dir: 'ltr' },
  zh: { name: '中文', tag: 'zh-Hans', dir: 'ltr' },
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/**
 * Builds a path for a locale.
 *
 * English lives at the site root rather than under `/en`, so it gets the
 * canonical URL and `hreflang="x-default"` without an extra redirect hop.
 */
export function localePath(locale: Locale, path = '/'): string {
  const clean = path === '/' ? '/' : `/${path.replace(/^\/|\/$/g, '')}/`
  return locale === DEFAULT_LOCALE ? clean : `/${locale}${clean === '/' ? '/' : clean}`
}

export function localeUrl(locale: Locale, path = '/'): string {
  return `${SITE_URL}${localePath(locale, path)}`
}

/**
 * Picks the best locale for a browser language list.
 * Used only for the dismissible "read this in your language" hint.
 */
export function matchLocale(languages: readonly string[]): Locale | null {
  for (const lang of languages) {
    const primary = lang.toLowerCase().split('-')[0]
    if (primary === 'ru') return 'ru'
    if (primary === 'zh') return 'zh'
    if (primary === 'en') return 'en'
  }
  return null
}
