import type { ReactNode } from 'react'
import { GoalLink } from '@/components/analytics/GoalLink'
import { PageHeader } from '@/components/layout/PageHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { Accordion } from '@/components/ui/Accordion'
import { Reveal } from '@/components/ui/Reveal'
import { localePath, type Locale } from '@/lib/i18n/config'
import { buildGuideJsonLd } from '@/lib/seo'

/** Shape every guide page's dictionary entry follows. */
export interface GuideContent {
  title: string
  intro: string
  /** ISO date (YYYY-MM-DD), also fed to the TechArticle dateModified. */
  updated: string
  sections: { title: string; body: string }[]
  faqTitle: string
  faq: { q: string; a: string }[]
  sourcesTitle: string
  sources: { label: string; url: string }[]
  ctaTitle: string
  ctaBody: string
  ctaLabel: string
}

interface GuidePageProps {
  locale: Locale
  /** Route path without locale prefix, e.g. `/claude-code-login`. */
  path: string
  guide: GuideContent
  /** Meta description, reused as the TechArticle description. */
  description: string
  /** ISO date the page first shipped. */
  datePublished: string
  /** Where the closing CTA points, without locale prefix, e.g. `/check`. */
  ctaPath: string
  /** Breadcrumb + back-link labels, from the dictionary. */
  crumbConverter: string
  updatedLabel: string
  backLabel: string
  /** Optional illustration (e.g. a <Terminal>), shown under the intro. */
  illustration?: ReactNode
}

/**
 * Renders a long-form problem/solution guide: header, prose sections, a Sources
 * list, an FAQ, and a CTA into a tool page — plus TechArticle + BreadcrumbList +
 * FAQPage structured data. Bodies may contain blank-line-separated paragraphs.
 */
export function GuidePage({
  locale,
  path,
  guide,
  description,
  datePublished,
  ctaPath,
  crumbConverter,
  updatedLabel,
  backLabel,
  illustration,
}: GuidePageProps) {
  const jsonLd = buildGuideJsonLd({
    locale,
    path,
    headline: guide.title,
    description,
    datePublished,
    dateModified: guide.updated,
    faq: guide.faq,
    trail: [
      { name: crumbConverter, path: '/' },
      { name: guide.title, path },
    ],
  })

  return (
    <>
      <JsonLd data={jsonLd} />

      <PageHeader locale={locale} title={guide.title} intro={guide.intro} backLabel={backLabel} />

      <article className="ant-container pt-6 pb-16 lg:pb-24">
        <div className="max-w-[var(--container-prose)]">
          <p className="font-sans text-detail-xs text-ink-faint">
            {updatedLabel}: {guide.updated}
          </p>

          {illustration && (
            <Reveal>
              <div className="mt-8">{illustration}</div>
            </Reveal>
          )}

          {guide.sections.map((section, i) => (
            <Reveal key={section.title} delay={i * 0.04}>
              <section className="mt-10 first:mt-8">
                <h2 className="text-display-xs sm:text-display-s">{section.title}</h2>
                {section.body.split('\n\n').map((para, j) => (
                  <p key={j} className="mt-4 text-paragraph-xs text-ink-secondary sm:text-paragraph-s">
                    {para}
                  </p>
                ))}
              </section>
            </Reveal>
          ))}

          {/* Sources */}
          <Reveal>
            <section className="mt-12 border-t border-line pt-8">
              <h2 className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
                {guide.sourcesTitle}
              </h2>
              <ul className="mt-4 flex flex-col gap-2">
                {guide.sources.map((source) => (
                  <li key={source.url}>
                    <a
                      href={source.url}
                      rel="noopener noreferrer external"
                      target="_blank"
                      className="ant-link font-sans text-detail-s text-ink-secondary hover:text-ink"
                    >
                      {source.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>
        </div>

        {/* FAQ */}
        <div className="mt-14 max-w-3xl">
          <Reveal>
            <h2 className="text-display-s sm:text-display-m">{guide.faqTitle}</h2>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="mt-8">
              <Accordion items={guide.faq} />
            </div>
          </Reveal>
        </div>

        {/* CTA into the tool */}
        <Reveal>
          <div className="mt-14 flex max-w-3xl flex-col gap-5 rounded-large border border-line bg-bg-secondary p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-display-xs">{guide.ctaTitle}</h2>
              <p className="mt-2 text-paragraph-xs text-ink-secondary">{guide.ctaBody}</p>
            </div>
            <GoalLink
              href={localePath(locale, ctaPath)}
              goal={ctaPath === '/check' ? 'checker_cta_click' : 'guide_cta_click'}
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-main bg-clay px-6 font-sans text-detail-l font-medium whitespace-nowrap text-clay-contrast transition-colors duration-200 ease-ant hover:bg-clay-hover"
            >
              {guide.ctaLabel}
            </GoalLink>
          </div>
        </Reveal>
      </article>
    </>
  )
}
