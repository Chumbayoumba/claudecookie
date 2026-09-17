import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CheckIntro } from '@/components/check/CheckIntro'
import { Terminal } from '@/components/guide/Terminal'
import { PageHeader } from '@/components/layout/PageHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { Accordion } from '@/components/ui/Accordion'
import { Reveal } from '@/components/ui/Reveal'
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
    faq: dict.check.faq,
    howSteps: dict.check.howSteps,
  })

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd(locale, [
          { name: dict.common.allTools, path: '/' },
          { name: dict.nav.check, path: PATH },
        ])}
      />
      <JsonLd data={jsonLd} />

      <PageHeader
        locale={locale}
        title={dict.check.title}
        intro={dict.check.subtitle}
        trail={[
          { href: '/', label: dict.common.allTools },
          { label: dict.nav.check },
        ]}
      />

      <section className="ant-container pt-8 pb-12 lg:pt-10 lg:pb-16">
        <CheckIntro locale={locale} dict={dict} />
      </section>

      <section className="ant-container pb-8">
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

      <section className="ant-container pb-4">
        <Reveal>
          <h2 className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
            {dict.check.readsTitle}
          </h2>
          <div className="mt-6 grid gap-px overflow-hidden rounded-large border border-line bg-line sm:grid-cols-3">
            {dict.check.reads.map((item) => (
              <div key={item.title} className="flex h-full flex-col bg-bg p-5">
                <h3 className="font-sans text-detail-l font-medium text-ink">{item.title}</h3>
                <p className="mt-2 text-paragraph-xs text-ink-secondary">{item.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="mt-10 border-t border-line bg-bg-secondary py-16 lg:py-20">
        <div className="ant-container">
          <Reveal>
            <h2 className="text-display-s sm:text-display-m">{dict.check.howTitle}</h2>
          </Reveal>
          <ol className="mt-10 grid gap-8 md:grid-cols-3 lg:gap-12">
            {dict.check.howSteps.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.08}>
                <li className="border-t border-line pt-6">
                  <span className="font-mono text-detail-s text-clay">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-3 text-display-xs">{step.title}</h3>
                  <p className="mt-3 text-paragraph-xs text-ink-secondary">{step.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="ant-container py-16 lg:py-24">
        <Reveal>
          <h2 className="text-display-s sm:text-display-m">{dict.check.faqTitle}</h2>
        </Reveal>
        <Reveal delay={0.06}>
          <div className="mt-10 max-w-3xl">
            <Accordion items={dict.check.faq} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
