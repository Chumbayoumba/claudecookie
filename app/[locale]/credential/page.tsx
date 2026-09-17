import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { Pill } from '@/components/ui/Pill'
import { Reveal } from '@/components/ui/Reveal'
import { getDictionary } from '@/lib/i18n'
import { LOCALES, isLocale, type Locale } from '@/lib/i18n/config'
import { buildBreadcrumbJsonLd, buildMetadata } from '@/lib/seo'

const PATH = '/credential'

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

  return {
    // Thin placeholder for an unshipped feature: noindex until it has real
    // content, so it does not drag down site quality or attract a credential-
    // tooling review. Kept follow + linked from the footer so users still find
    // it, and removed from app/sitemap.ts.
    ...buildMetadata({
      locale: raw,
      path: PATH,
      title: dict.meta.credential.title,
      description: dict.meta.credential.description,
      includeHreflang: false,
    }),
    robots: { index: false, follow: true },
  }
}

export default async function CredentialPage({ params }: PageProps) {
  const { locale: raw } = await params
  if (!isLocale(raw)) notFound()

  const locale = raw as Locale
  const dict = getDictionary(locale)
  const page = dict.pages.credential

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

      <div className="ant-container py-12 lg:py-16">
        <div className="max-w-[var(--container-prose)]">
          <Reveal>
            <Pill tone="accent">{page.badge}</Pill>
          </Reveal>

          <Reveal delay={0.05}>
            <h2 className="mt-8 font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
              {page.leadTitle}
            </h2>
            <div className="mt-6 grid gap-px overflow-hidden rounded-large border border-line bg-line sm:grid-cols-3">
              {page.steps.map((step, i) => (
                <div key={step.title} className="flex h-full flex-col bg-bg p-6">
                  <span className="font-mono text-detail-s text-clay">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-3 font-sans text-detail-l font-medium text-ink">{step.title}</h3>
                  <p className="mt-2 text-paragraph-xs text-ink-secondary">{step.body}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mt-6 rounded-large border border-line bg-bg-secondary p-6 text-paragraph-xs text-ink-secondary">
              {page.note}
            </p>
          </Reveal>
        </div>
      </div>
    </>
  )
}
