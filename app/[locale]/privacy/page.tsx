import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { Reveal } from '@/components/ui/Reveal'
import { getDictionary } from '@/lib/i18n'
import { LOCALES, isLocale, type Locale } from '@/lib/i18n/config'
import { buildBreadcrumbJsonLd, buildMetadata } from '@/lib/seo'

const PATH = '/privacy'

/** Bumped by hand when the policy text changes, not on every deploy. */
const LAST_UPDATED = '2026-09-13'

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
          { name: dict.footer.converter, path: '/' },
          { name: page.title, path: PATH },
        ])}
      />

      <PageHeader
        locale={locale}
        title={page.title}
        intro={page.intro}
        backLabel={dict.common.backToConverter}
      />

      <div className="ant-container pt-6 pb-16 lg:pt-8 lg:pb-24">
        <div className="max-w-[var(--container-prose)]">
          <p className="font-sans text-detail-xs text-ink-faint">
            {page.updated}: <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
          </p>

          <div className="mt-10 flex flex-col gap-10">
            {page.sections.map((section, i) => (
              <Reveal key={section.title} delay={i * 0.03}>
                <section className="border-t border-line pt-8">
                  <h2 className="text-display-xs sm:text-display-s">{section.title}</h2>
                  <p className="mt-4 max-w-[62ch] text-paragraph-xs text-ink-secondary">
                    {section.body}
                  </p>
                </section>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <section className="mt-16 rounded-large border border-line bg-bg-secondary p-8">
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
