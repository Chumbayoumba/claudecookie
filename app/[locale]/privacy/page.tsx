import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { Reveal } from '@/components/ui/Reveal'
import { getDictionary } from '@/lib/i18n'
import { LOCALES, isLocale, type Locale } from '@/lib/i18n/config'
import { buildBreadcrumbJsonLd, buildMetadata } from '@/lib/seo'
import { cn } from '@/lib/utils/cn'

const PATH = '/privacy'

/** Bumped by hand when the policy text changes, not on every deploy. */
const LAST_UPDATED = '2026-09-18'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

interface PageProps {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale: raw } = await params
  if (!isLocale(raw)) return {}
  const dict = getDictionary(raw)

  return buildMetadata({
    locale: raw,
    path: PATH,
    title: dict.meta.privacy.title,
    description: dict.meta.privacy.description,
  })
}

export default async function PrivacyPage({ params }: PageProps) {
  const { locale: raw } = await params
  if (!isLocale(raw)) notFound()

  const locale = raw as Locale
  const dict = getDictionary(locale)
  const page = dict.pages.privacy

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd(locale, [
          { name: dict.footer.docs, path: '/formats/netscape-cookies-txt' },
          { name: page.title, path: PATH },
        ])}
      />

      <PageHeader
        locale={locale}
        title={page.title}
        intro={page.intro}
        trail={[{ label: dict.footer.docs }, { label: page.title }]}
      />

      <div className="ant-container pt-6 pb-16 lg:pt-8 lg:pb-24">
        <div className="max-w-[var(--container-prose)]">
          <p className="font-sans text-detail-xs text-ink-faint">
            {page.updated}: <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
          </p>

          <ul className="mt-10 divide-y divide-line border-y border-line">
            {page.summary.map((row) => (
              <li
                key={row.label}
                className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
              >
                <p className="font-sans text-detail-s font-medium text-ink">{row.label}</p>
                <p
                  className={cn(
                    'font-sans text-detail-s sm:text-right',
                    row.leaves ? 'text-ink-secondary' : 'text-ok',
                  )}
                >
                  {row.note}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-col gap-10">
            {page.sections.map((section, i) => (
              <Reveal key={section.title} delay={i * 0.03}>
                <section>
                  <h2 className="text-display-xs sm:text-display-s">{section.title}</h2>
                  <p className="mt-4 max-w-[62ch] text-paragraph-xs text-ink-secondary">
                    {section.body}
                  </p>
                </section>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <section className="mt-16 border-t border-line pt-8">
              <h2 className="text-display-xs">{page.disclaimerTitle}</h2>
              <p className="mt-4 max-w-[62ch] text-paragraph-xs text-ink-secondary">
                {page.disclaimerBody}
              </p>
            </section>
          </Reveal>
        </div>
      </div>
    </>
  )
}
