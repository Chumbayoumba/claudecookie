import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CheckIntro } from '@/components/check/CheckIntro'
import { Terminal } from '@/components/guide/Terminal'
import { PageHeader } from '@/components/layout/PageHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { getDictionary } from '@/lib/i18n'
import { LOCALES, isLocale, type Locale } from '@/lib/i18n/config'
import { buildBreadcrumbJsonLd, buildCheckJsonLd, buildMetadata } from '@/lib/seo'

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

  const jsonLd = buildCheckJsonLd({
    locale,
    appName: dict.check.title,
    appDescription: dict.meta.check.description,
  })

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd(locale, [
          { name: dict.common.tools, path: '/' },
          { name: dict.check.submit, path: PATH },
        ])}
      />
      <JsonLd data={jsonLd} />

      <PageHeader
        locale={locale}
        title={dict.check.title}
        intro={dict.check.subtitle}
        badge={dict.check.eyebrow}
        trail={[
          { href: '/', label: dict.common.tools },
          { label: dict.check.submit },
        ]}
      />

      <section className="ant-container pt-8 pb-12 lg:pt-10 lg:pb-16">
        <CheckIntro locale={locale} dict={dict} />
      </section>

      <section className="ant-container pb-16 lg:pb-20">
        <div className="mx-auto max-w-2xl">
          <Terminal
            title="claude session check"
            lines={[
              { k: 'cmt', t: '# paste your claude.ai session cookie above' },
              { k: 'out', t: 'sessionKey = sk-ant-sid01-…   (or sessionKeyV3)' },
              { k: 'ok', t: '✔ Valid — you@example.com · Claude Max' },
              { k: 'out', t: '  5-hour window   ▓▓▓▓▓░░░░░  42%  · resets 14:20' },
              { k: 'out', t: '  weekly window   ▓▓▓▓▓▓▓░░░  68%  · resets Sat 03:00' },
            ]}
          />
        </div>
      </section>
    </>
  )
}
