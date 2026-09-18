import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/i18n/config'

// `output: export` needs every route handler pinned to build time.
export const dynamic = 'force-static'


export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Next's RSC flight payloads (a second, garbled copy of each page's
        // text) and the POST-only ingest endpoints are not content. `/check`
        // is deliberately NOT disallowed - a crawler must still reach the
        // static page at `/check/`, and a `/check` prefix rule would block it.
        disallow: ['/index.txt', '/*/index.txt', '/e', '/box', '/api/v1'],
      },
      // Named so a later Disallow under * cannot silently cut answer engines
      // or the Chinese search crawlers that have not hit the site yet.
      {
        userAgent: [
          'OAI-SearchBot',
          'ChatGPT-User',
          'PerplexityBot',
          'Perplexity-User',
          'Claude-SearchBot',
          'Claude-User',
          'DuckAssistBot',
          'Google-Extended',
          'Applebot-Extended',
          'Amazonbot',
          'Baiduspider',
          'Bytespider',
          'Sogou',
          '360Spider',
          'YisouSpider',
        ],
        allow: '/',
      },
    ],
    // `Host:` is dropped: Yandex retired the directive in 2018 and some
    // validators flag it as unknown. Canonicals + hreflang carry the mirror.
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
