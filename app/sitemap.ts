import type { MetadataRoute } from 'next'
import { LOCALES, LOCALE_META, localeUrl } from '@/lib/i18n/config'

// `output: export` needs every route handler pinned to build time.
export const dynamic = 'force-static'


/** Every page, in every locale, with the full alternates set on each entry. */
const ROUTES = [
  { path: '/', priority: 1, changeFrequency: 'monthly' as const },
  { path: '/check', priority: 0.7, changeFrequency: 'monthly' as const },
  { path: '/credential', priority: 0.5, changeFrequency: 'monthly' as const },
  { path: '/formats/netscape-cookies-txt', priority: 0.8, changeFrequency: 'yearly' as const },
  { path: '/formats/json-cookies', priority: 0.8, changeFrequency: 'yearly' as const },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return ROUTES.flatMap((route) =>
    LOCALES.map((locale) => ({
      url: localeUrl(locale, route.path),
      lastModified,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: {
        languages: {
          ...Object.fromEntries(
            LOCALES.map((l) => [LOCALE_META[l].tag, localeUrl(l, route.path)]),
          ),
          // Matches the x-default on the pages themselves: English at the root
          // is where an unmatched visitor lands.
          'x-default': localeUrl('en', route.path),
        },
      },
    })),
  )
}
