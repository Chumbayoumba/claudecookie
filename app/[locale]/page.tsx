import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Converter } from '@/components/converter/Converter'
import { Hero } from '@/components/converter/Hero'
import { JsonLd } from '@/components/seo/JsonLd'
import { Accordion } from '@/components/ui/Accordion'
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

      <section className="ant-container pt-12 pb-10 sm:pt-16 lg:pt-20">
        <Hero dict={dict} />
      </section>

      <section className="ant-container pb-16" aria-label={dict.hero.eyebrow}>
        <Converter locale={locale} dict={dict} />
      </section>

      {/* Checker promo */}
      <section className="ant-container pb-4">
        <Reveal>
          <div className="flex flex-col gap-6 overflow-hidden rounded-large border border-line bg-bg-secondary p-8 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="font-sans text-detail-xs font-semibold tracking-[0.12em] text-clay uppercase">
                {dict.checkPromo.eyebrow}
              </p>
              <h2 className="mt-4 text-display-xs sm:text-display-s">{dict.checkPromo.title}</h2>
              <p className="mt-4 text-paragraph-xs text-ink-secondary">{dict.checkPromo.body}</p>
            </div>
            <a
              href={localePath(locale, '/check')}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-main border border-transparent bg-clay px-6 font-sans text-detail-l font-medium whitespace-nowrap text-clay-contrast transition-colors duration-200 ease-ant hover:bg-clay-hover"
            >
              {dict.checkPromo.cta}
              <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
                <path
                  d="M6 3.5 10.5 8 6 12.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </Reveal>
      </section>

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
      <section className="border-y border-line bg-bg-secondary py-16 lg:py-24">
        <div className="ant-container">
          <Reveal>
            <h2 className="text-display-s sm:text-display-m">{dict.pages.json.formatsTitle}</h2>
          </Reveal>

          <div className="mt-10 grid gap-px overflow-hidden rounded-large border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {ALL_FORMATS.map((format, i) => (
              <Reveal key={format} delay={i * 0.05} className="bg-bg">
                <div className="h-full p-6">
                  <h3 className="font-sans text-detail-l font-medium text-ink">
                    {dict.formats[format].label}
                  </h3>
                  <p className="mt-2 font-mono text-detail-xs text-ink-faint">
                    {dict.formats[format].hint}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
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
