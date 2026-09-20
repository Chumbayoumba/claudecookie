import type { ReactNode } from 'react'
import { GoalLink } from '@/components/analytics/GoalLink'
import { GuideToc } from '@/components/guide/GuideToc'
import { sectionId } from '@/components/guide/sectionId'
import { PageHeader } from '@/components/layout/PageHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { Accordion } from '@/components/ui/Accordion'
import { Reveal } from '@/components/ui/Reveal'
import { getDictionary } from '@/lib/i18n'
import { localePath, type Locale } from '@/lib/i18n/config'
import { buildGuideJsonLd } from '@/lib/seo'

/** Shape every guide page's dictionary entry follows. */
export interface GuideContent {
  title: string
  intro: string
  /** ISO date (YYYY-MM-DD), also fed to the TechArticle dateModified. */
  updated: string
  readMinutes: number
  sections: { title: string; body: string }[]
  /** Optional comparison table used by guides that have plan-specific data. */
  comparisonTable?: {
    caption: string
    headers: string[]
    rows: string[][]
  }
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
  homeLabel: string
  guidesLabel: string
  badge: string
  onThisPage: string
  updatedLabel: string
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
  guidesLabel,
  badge,
  onThisPage,
  illustration,
}: GuidePageProps) {
  const dict = getDictionary(locale)
  const faqId = 'faq'
  const sourcesId = sectionId(guide.sourcesTitle, 90)
  const toc = [
    ...guide.sections.map((section, i) => ({
      id: sectionId(section.title, i),
      title: section.title,
    })),
    { id: sourcesId, title: guide.sourcesTitle },
    { id: faqId, title: guide.faqTitle },
  ]

  const jsonLd = buildGuideJsonLd({
    locale,
    path,
    headline: guide.title,
    description,
    datePublished,
    dateModified: guide.updated,
    faq: guide.faq,
    trail: [
      { name: guidesLabel, path },
      { name: guide.title, path },
    ],
  })

  return (
    <>
      <JsonLd data={jsonLd} />

      <PageHeader
        locale={locale}
        title={guide.title}
        intro={guide.intro}
        badge={badge}
        trail={[{ label: guidesLabel }, { label: guide.title }]}
      />

      <article className="ant-container pt-6 pb-16 lg:pb-24">
        <div className="lg:grid lg:grid-cols-[minmax(0,45rem)_14rem] lg:items-start lg:gap-16">
          <div className="max-w-[45rem]">
            <p className="font-sans text-detail-xs text-ink-faint">
              {guide.readMinutes} {dict.common.minRead} · {guide.updated}
            </p>

            {illustration && (
              <Reveal>
                <div className="mt-8">{illustration}</div>
              </Reveal>
            )}

            {guide.sections.map((section, i) => (
              <Reveal key={section.title} delay={i * 0.04}>
                <section id={sectionId(section.title, i)} className="mt-10 scroll-mt-28 first:mt-8">
                  <h2 className="text-display-xs sm:text-display-s">{section.title}</h2>
                  {section.body.split('\n\n').map((para, j) => (
                    <p
                      key={j}
                      className="mt-4 text-paragraph-xs text-ink-secondary sm:text-paragraph-s"
                    >
                      {para}
                    </p>
                  ))}
                </section>
              </Reveal>
            ))}

            {guide.comparisonTable && (
              <Reveal>
                <div className="mt-10 overflow-x-auto rounded-large border border-line">
                  <table className="min-w-full border-collapse text-left font-sans text-detail-s text-ink-secondary">
                    <caption className="border-b border-line bg-bg-secondary px-4 py-3 text-left font-semibold text-ink">
                      {guide.comparisonTable.caption}
                    </caption>
                    <thead className="bg-bg-secondary">
                      <tr>
                        {guide.comparisonTable.headers.map((header) => (
                          <th key={header} className="border-b border-line px-4 py-3 font-semibold text-ink">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {guide.comparisonTable.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-line last:border-b-0">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-4 py-3 align-top">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Reveal>
            )}

            <Reveal>
              <section id={sourcesId} className="mt-12 scroll-mt-28 border-t border-line pt-8">
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

          <GuideToc label={onThisPage} items={toc} />
        </div>

        <div id={faqId} className="mt-14 max-w-[45rem] scroll-mt-28">
          <Reveal>
            <h2 className="text-display-s sm:text-display-m">{guide.faqTitle}</h2>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="mt-8">
              <Accordion items={guide.faq} />
            </div>
          </Reveal>
        </div>

        <Reveal>
          <div className="mt-14 flex max-w-[45rem] flex-col gap-5 rounded-large border border-line bg-bg-secondary p-8 sm:flex-row sm:items-center sm:justify-between">
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
