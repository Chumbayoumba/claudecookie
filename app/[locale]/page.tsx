import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Converter } from '@/components/converter/Converter'
import { Hero } from '@/components/converter/Hero'
import { JsonLd } from '@/components/seo/JsonLd'
import { Accordion } from '@/components/ui/Accordion'
import { MoreTools } from '@/components/ui/MoreTools'
import { Reveal } from '@/components/ui/Reveal'
import { ALL_FORMATS } from '@/lib/cookies'
import { getDictionary } from '@/lib/i18n'
import { LOCALES, isLocale, localePath, type Locale } from '@/lib/i18n/config'
import { buildHomeJsonLd, buildMetadata } from '@/lib/seo'

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
    path: '/',
    title: dict.meta.home.title,
    description: dict.meta.home.description,
  })
}

export default async function HomePage({ params }: PageProps) {
  const { locale: raw } = await params
  if (!isLocale(raw)) notFound()

  const locale = raw as Locale
  const dict = getDictionary(locale)

  const jsonLd = buildHomeJsonLd({
    locale,
    faq: dict.faq.items,
    howSteps: dict.how.steps,
    appName: dict.meta.home.title,
    appDescription: dict.meta.home.description,
  })

  return (
    <>
      <JsonLd data={jsonLd} />

      <section className="ant-container pt-10 pb-6 sm:pt-12 lg:pt-14">
        <Hero dict={dict} />
      </section>

      <section className="ant-container pb-12" aria-label={dict.hero.eyebrow}>
        <Converter locale={locale} dict={dict} />
      </section>

      <Reveal>
        <MoreTools locale={locale} dict={dict} />
      </Reveal>

      {/* How it works */}
      <section className="ant-container py-16 lg:py-24">
        <Reveal>
          <h2 className="text-display-s sm:text-display-m">{dict.how.title}</h2>
        </Reveal>

        <ol className="mt-10 grid gap-8 md:grid-cols-3 lg:gap-12">
          {dict.how.steps.map((step, i) => (
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
      </section>

      {/* Supported formats */}
      <section className="ant-container py-16 lg:py-24">
        <Reveal>
          <h2 className="text-display-s sm:text-display-m">{dict.home.formatsTitle}</h2>
        </Reveal>

        <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {ALL_FORMATS.map((format) => {
            // Each item links to the reference page that documents it - the
            // home page's only contextual links into the two /formats/ pages,
            // which otherwise get inbound links from the footer alone.
            const href =
              format === 'netscape'
                ? localePath(locale, '/formats/netscape-cookies-txt')
                : localePath(locale, '/formats/json-cookies')
            return (
              <a key={format} href={href} className="group block no-underline">
                <h3 className="font-sans text-detail-l font-medium text-ink group-hover:text-clay">
                  {dict.formats[format].label}
                </h3>
                <p className="mt-2 font-mono text-detail-xs text-ink-faint">
                  {dict.formats[format].hint}
                </p>
              </a>
            )
          })}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="ant-container py-16 lg:py-24">
        <Reveal>
          <h2 className="text-display-s sm:text-display-m">{dict.faq.title}</h2>
        </Reveal>
        <Reveal delay={0.06}>
          <div className="mt-10 max-w-3xl">
            <Accordion items={dict.faq.items} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
