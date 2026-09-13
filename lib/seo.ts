import type { Metadata } from 'next'
import { LOCALES, LOCALE_META, SITE_URL, localeUrl, type Locale } from './i18n/config'

interface PageMetaInput {
  locale: Locale
  /** Route path without a locale prefix, e.g. `/privacy`. */
  path: string
  title: string
  description: string
}

/**
 * Builds per-page metadata including the full hreflang set.
 *
 * Every page advertises all three locales plus `x-default`, which points at the
 * English version living at the site root - that is the URL the geo redirect
 * sends unmatched visitors to, so the two stay consistent.
 */
export function buildMetadata({ locale, path, title, description }: PageMetaInput): Metadata {
  const canonical = localeUrl(locale, path)

  const languages: Record<string, string> = {}
  for (const l of LOCALES) {
    languages[LOCALE_META[l].tag] = localeUrl(l, path)
  }
  languages['x-default'] = localeUrl('en', path)

  return {
    title,
    description,
    alternates: { canonical, languages },
    openGraph: {
      type: 'website',
      siteName: 'claudecookie',
      url: canonical,
      title,
      description,
      locale: LOCALE_META[locale].tag.replace('-', '_'),
      images: [{ url: `${SITE_URL}/og.png`, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_URL}/og.png`],
    },
  }
}

interface JsonLdInput {
  locale: Locale
  faq: { q: string; a: string }[]
  howSteps: { title: string; body: string }[]
  appName: string
  appDescription: string
}

/**
 * Structured data for the converter page.
 *
 * `SoftwareApplication` describes the tool itself, `FAQPage` feeds the FAQ rich
 * result, and `HowTo` covers the three-step explanation. All three render from
 * the same translated copy shown on the page, which is what Google requires.
 */
export function buildHomeJsonLd({
  locale,
  faq,
  howSteps,
  appName,
  appDescription,
}: JsonLdInput) {
  const url = localeUrl(locale, '/')

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        '@id': `${url}#app`,
        name: appName,
        description: appDescription,
        url,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any',
        inLanguage: LOCALE_META[locale].tag,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
      {
        '@type': 'HowTo',
        '@id': `${url}#howto`,
        name: appName,
        step: howSteps.map((step, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: step.title,
          text: step.body,
        })),
      },
    ],
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
      item: localeUrl(locale, item.path),
    })),
  }
}
