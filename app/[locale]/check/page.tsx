import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CheckIntro } from '@/components/check/CheckIntro'
import { PageHeader } from '@/components/layout/PageHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { getDictionary } from '@/lib/i18n'
import { LOCALES, isLocale, type Locale } from '@/lib/i18n/config'
import { buildBreadcrumbJsonLd, buildMetadata } from '@/lib/seo'

const PATH = '/check'

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
    title: dict.meta.check.title,
    description: dict.meta.check.description,
  })
}

export default async function CheckPage({ params }: PageProps) {
  const { locale: raw } = await params
  if (!isLocale(raw)) notFound()

  const locale = raw as Locale
  const dict = getDictionary(locale)

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd(locale, [
          { name: dict.footer.converter, path: '/' },
          { name: dict.nav.check, path: PATH },
        ])}
      />

      <PageHeader
        locale={locale}
        title={dict.check.title}
        intro={dict.check.subtitle}
        backLabel={dict.common.backToConverter}
      />

      <section className="ant-container pt-8 pb-16 lg:pt-10 lg:pb-24">
        <CheckIntro locale={locale} dict={dict} />
      </section>
    </>
  )
}
