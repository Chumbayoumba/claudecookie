import type { MetadataRoute } from 'next'
import { LOCALES, LOCALE_META, localeUrl } from '@/lib/i18n/config'

// `output: export` needs every route handler pinned to build time.
export const dynamic = 'force-static'


/**
 * Every page, in every locale, with the full alternates set on each entry.
 *
 * `lastModified` is a hand-maintained per-route date, NOT `new Date()`: a
 * build-time timestamp is identical across all URLs and churns on every deploy,
 * which teaches Google and Yandex to distrust the lastmod signal entirely. Bump
 * a route's date only when that page's content actually changes.
 */
const ROUTES = [
  { path: '/', priority: 1, changeFrequency: 'monthly' as const, lastModified: '2026-09-19' },
  { path: '/api', priority: 0.8, changeFrequency: 'monthly' as const, lastModified: '2026-09-19' },
  { path: '/check', priority: 0.7, changeFrequency: 'monthly' as const, lastModified: '2026-09-19' },
  { path: '/claude-code-login', priority: 0.8, changeFrequency: 'monthly' as const, lastModified: '2026-09-19' },
  { path: '/claude-usage-limits', priority: 0.8, changeFrequency: 'monthly' as const, lastModified: '2026-09-19' },
  { path: '/credential', priority: 0.7, changeFrequency: 'monthly' as const, lastModified: '2026-09-19' },
  { path: '/formats/netscape-cookies-txt', priority: 0.8, changeFrequency: 'yearly' as const, lastModified: '2026-09-19' },
  { path: '/formats/json-cookies', priority: 0.8, changeFrequency: 'yearly' as const, lastModified: '2026-09-19' },
  { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const, lastModified: '2026-09-18' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.flatMap((route) =>
    LOCALES.map((locale) => ({
      url: localeUrl(locale, route.path),
      lastModified: route.lastModified,
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
