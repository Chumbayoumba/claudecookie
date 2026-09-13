import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { Reveal } from '@/components/ui/Reveal'
import { SAMPLE_NETSCAPE } from '@/lib/cookies/samples'
import { getDictionary } from '@/lib/i18n'
import { LOCALES, isLocale, localePath, type Locale } from '@/lib/i18n/config'
import { buildBreadcrumbJsonLd, buildMetadata } from '@/lib/seo'

const PATH = '/formats/netscape-cookies-txt'

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
    title: dict.meta.netscape.title,
    description: dict.meta.netscape.description,
  })
}

export default async function NetscapeFormatPage({ params }: PageProps) {
  const { locale: raw } = await params
  if (!isLocale(raw)) notFound()

  const locale = raw as Locale
  const dict = getDictionary(locale)
  const page = dict.pages.netscape

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

      <div className="ant-container py-16 lg:py-20">
        <div className="max-w-[var(--container-prose)]">
          {/* Example */}
          <Reveal>
            <CodeBlock code={SAMPLE_NETSCAPE} caption="cookies.txt" />
          </Reveal>

          {/* Field reference */}
          <Reveal>
            <h2 className="mt-16 text-display-s sm:text-display-m">{page.fieldsTitle}</h2>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="ant-scroll mt-8 overflow-x-auto rounded-large border border-line">
              <table className="w-full min-w-[46rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line bg-bg-secondary">
                    <th className="px-4 py-3 font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
                      #
                    </th>
                    <th className="px-4 py-3 font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
                      {dict.common.field}
                    </th>
                    <th className="px-4 py-3 font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
                      {dict.common.meaning}
                    </th>
                    <th className="px-4 py-3 font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
                      {dict.common.values}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {page.fields.map((field, i) => (
                    <tr key={field.name} className="align-top">
                      <td className="px-4 py-4 font-mono text-detail-xs text-ink-faint">{i + 1}</td>
                      <td className="px-4 py-4 font-mono text-detail-s whitespace-nowrap text-clay">
                        {field.name}
                      </td>
                      <td className="max-w-md px-4 py-4 text-paragraph-xs text-ink-secondary">
                        {field.meaning}
                      </td>
                      <td className="px-4 py-4 font-mono text-detail-xs whitespace-nowrap text-ink">
                        {field.values}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>

          {/* #HttpOnly_ */}
          <Reveal>
            <h2 className="mt-16 text-display-s sm:text-display-m">{page.httpOnlyTitle}</h2>
            <p className="mt-6 text-paragraph-xs text-ink-secondary">{page.httpOnlyBody}</p>
          </Reveal>

          {/* Gotchas */}
          <Reveal>
            <h2 className="mt-16 text-display-s sm:text-display-m">{page.gotchasTitle}</h2>
          </Reveal>
          <ul className="mt-8 flex flex-col gap-5">
            {page.gotchas.map((gotcha, i) => (
              <Reveal key={gotcha} delay={i * 0.04}>
                <li className="flex gap-4 border-t border-line pt-5">
                  <span aria-hidden className="mt-[0.6rem] size-1.5 shrink-0 rounded-round bg-clay" />
                  <p className="text-paragraph-xs text-ink-secondary">{gotcha}</p>
                </li>
              </Reveal>
            ))}
          </ul>

          {/* Tools */}
          <Reveal>
            <h2 className="mt-16 text-display-s sm:text-display-m">{page.toolsTitle}</h2>
          </Reveal>
          <dl className="mt-8 grid gap-px overflow-hidden rounded-large border border-line bg-line sm:grid-cols-2">
            {page.tools.map((tool, i) => (
              <Reveal key={tool.name} delay={i * 0.04} className="bg-bg">
                <div className="h-full p-6">
                  <dt className="font-mono text-detail-s text-clay">{tool.name}</dt>
                  <dd className="mt-2 text-paragraph-xs text-ink-secondary">{tool.body}</dd>
                </div>
              </Reveal>
            ))}
          </dl>

          <Reveal>
            <div className="mt-16 rounded-large border border-line bg-bg-secondary p-8">
              <p className="text-paragraph-s">{dict.common.tryIt}</p>
              <a
                href={localePath(locale, '/')}
                className="mt-5 inline-flex h-11 items-center rounded-main bg-invert px-5 font-sans text-detail-m font-medium text-invert-ink transition-colors duration-200 ease-ant hover:bg-invert-hover"
              >
                {dict.footer.converter}
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </>
  )
}
