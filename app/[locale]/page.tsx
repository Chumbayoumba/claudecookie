import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Converter } from '@/components/converter/Converter'
import { Hero } from '@/components/converter/Hero'
import { JsonLd } from '@/components/seo/JsonLd'
import { Accordion } from '@/components/ui/Accordion'
import { ApiHint } from '@/components/ui/ApiHint'
import { MoreTools } from '@/components/ui/MoreTools'
import { Reveal } from '@/components/ui/Reveal'
import { getDictionary } from '@/lib/i18n'
import { LOCALES, isLocale, type Locale } from '@/lib/i18n/config'
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
    appName: dict.meta.home.title,
    appDescription: dict.meta.home.description,
    faq: dict.faq.items,
  })

  return (
    <>
      <JsonLd data={jsonLd} />

      <section className="ant-container pt-10 pb-6 sm:pt-12 lg:pt-14">
        <Hero dict={dict} />
      </section>

      <section className="ant-container pb-6" aria-label={dict.hero.eyebrow}>
        <Converter locale={locale} dict={dict} />
        <ApiHint locale={locale} hint={dict.common.tryApi} link={dict.common.tryApiLink} />
      </section>

      <Reveal>
        <MoreTools locale={locale} dict={dict} />
      </Reveal>

      <section id="faq" className="ant-container pt-10 pb-16 scroll-mt-28">
        <Reveal>
          <h2 className="text-display-s sm:text-display-m">{dict.faq.title}</h2>
        </Reveal>
        <Reveal delay={0.06}>
          <div className="mt-8 max-w-[45rem]">
            <Accordion items={dict.faq.items} />
          </div>
        </Reveal>
      </section>
    </>
  )
}
