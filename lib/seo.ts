import type { Metadata } from 'next'
import { LOCALES, LOCALE_META, SITE_URL, localeUrl, type Locale } from './i18n/config'

/**
 * Open Graph locale codes: language_TERRITORY (ISO 639-1 + ISO 3166-1 alpha-2).
 * This is NOT the hreflang tag - `zh-Hans` is a script subtag and is invalid as
 * an og:locale, so Chinese maps to `zh_CN` here while hreflang stays `zh-Hans`.
 */
const OG_LOCALE: Record<Locale, string> = {
  en: 'en_US',
  ru: 'ru_RU',
  zh: 'zh_CN',
}

interface PageMetaInput {
  locale: Locale
  /** Route path without a locale prefix, e.g. `/privacy`. */
  path: string
  title: string
  description: string
  /** Set false on noindex placeholders so they do not pollute language clusters. */
  includeHreflang?: boolean
}

/**
 * Builds per-page metadata including the full hreflang set.
 *
 * Every indexable page advertises all three locales plus `x-default`, which
 * points at the English version living at the site root - that is the URL the
 * geo redirect sends unmatched visitors to, so the two stay consistent.
 * `zh-CN` aliases the same Chinese URL: Google already has `zh-Hans`, while
 * Baidu and several Chinese engines still key off the country tag.
 */
export function buildMetadata({
  locale,
  path,
  title,
  description,
  includeHreflang = true,
}: PageMetaInput): Metadata {
  const canonical = localeUrl(locale, path)

  const languages: Record<string, string> = {}
  if (includeHreflang) {
    for (const l of LOCALES) {
      languages[LOCALE_META[l].tag] = localeUrl(l, path)
    }
    languages['zh-CN'] = localeUrl('zh', path)
    languages['x-default'] = localeUrl('en', path)
  }

  return {
    title,
    description,
    alternates: includeHreflang ? { canonical, languages } : { canonical },
    openGraph: {
      type: 'website',
      siteName: 'claudecookie',
      url: canonical,
      title,
      description,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      images: [{ url: `${SITE_URL}/og.png`, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: `${SITE_URL}/og.png`, alt: title }],
    },
  }
}

interface JsonLdInput {
  locale: Locale
  appName: string
  appDescription: string
}

/**
 * Structured data for the converter page.
 *
 * `WebApplication` describes the tool itself. FAQ/HowTo stay off this page so
 * the graph only marks up what the visitor can actually see.
 */
export function buildHomeJsonLd({
  locale,
  appName,
  appDescription,
}: JsonLdInput) {
  const url = localeUrl(locale, '/')

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        // Site entity identity. No potentialAction/SearchAction: the site has no
        // search endpoint, and fabricating one is exactly the kind of markup a
        // manual reviewer penalises.
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: 'claudecookie',
        url: `${SITE_URL}/`,
        inLanguage: LOCALE_META[locale].tag,
        publisher: { '@id': `${SITE_URL}/#org` },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#org`,
        name: 'claudecookie',
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/icon-512.png`,
      },
      {
        '@type': 'WebApplication',
        '@id': `${url}#app`,
        name: appName,
        description: appDescription,
        url,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript. Runs entirely in the browser.',
        inLanguage: LOCALE_META[locale].tag,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        publisher: { '@id': `${SITE_URL}/#org` },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
    ],
  }
}


/**
 * Structured data for the /check/ tool page. FAQ/HowTo stay off this page so
 * the graph only marks up the checker the visitor can actually see.
 */
export function buildCheckJsonLd({
  locale,
  appName,
  appDescription,
}: JsonLdInput) {
  const url = localeUrl(locale, '/check')

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${url}#app`,
        name: appName,
        description: appDescription,
        url,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript. Runs in the browser.',
        inLanguage: LOCALE_META[locale].tag,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        publisher: { '@id': `${SITE_URL}/#org` },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
    ],
  }
}


/**
 * Structured data for a guide/article page: TechArticle (authored + published by
 * the claudecookie Organization, with real dates), a BreadcrumbList, and an
 * optional FAQPage. FAQ/HowTo rich results are restricted in 2026, but the markup
 * still helps Bing, Yandex and AI answer engines attribute and cite the page.
 */
export function buildGuideJsonLd({
  locale,
  path,
  headline,
  description,
  datePublished,
  dateModified,
  faq,
  trail,
}: {
  locale: Locale
  path: string
  headline: string
  description: string
  datePublished: string
  dateModified: string
  faq?: { q: string; a: string }[]
  trail: { name: string; path: string }[]
}) {
  const url = localeUrl(locale, path)

  const article = {
    '@type': 'TechArticle',
    '@id': `${url}#article`,
    headline,
    description,
    url,
    inLanguage: LOCALE_META[locale].tag,
    datePublished,
    dateModified,
    author: { '@type': 'Organization', name: 'claudecookie', url: `${SITE_URL}/` },
    publisher: { '@id': `${SITE_URL}/#org` },
    isPartOf: { '@id': `${SITE_URL}/#website` },
  }

  const breadcrumb = {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: {
        '@type': 'WebPage',
        '@id': localeUrl(locale, item.path),
        name: item.name,
      },
    })),
  }

  const faqNode =
    faq && faq.length
      ? [
          {
            '@type': 'FAQPage',
            '@id': `${url}#faq`,
            mainEntity: faq.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          },
        ]
      : []

  return {
    '@context': 'https://schema.org',
    '@graph': [article, breadcrumb, ...faqNode],
  }
}

/** Breadcrumbs for the reference pages, so the SERP shows the path not the URL. */
export function buildBreadcrumbJsonLd(
  locale: Locale,
  trail: { name: string; path: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: {
        '@type': 'WebPage',
        '@id': localeUrl(locale, item.path),
        name: item.name,
      },
    })),
  }
}
