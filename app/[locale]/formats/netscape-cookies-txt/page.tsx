import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GuideToc } from '@/components/guide/GuideToc'
import { sectionId } from '@/components/guide/sectionId'
import { PageHeader } from '@/components/layout/PageHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { Pill } from '@/components/ui/Pill'
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

  const overviewId = sectionId('Overview', 0)
  const fieldsId = sectionId(page.fieldsTitle, 1)
  const httpOnlyId = sectionId(page.httpOnlyTitle, 2)
  const gotchasId = sectionId(page.gotchasTitle, 3)
  const toolsId = sectionId(page.toolsTitle, 4)

  const toc = [
    { id: overviewId, title: dict.common.example },
    { id: fieldsId, title: page.fieldsTitle },
    { id: httpOnlyId, title: page.httpOnlyTitle },
    { id: gotchasId, title: page.gotchasTitle },
    { id: toolsId, title: page.toolsTitle },
  ]

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd(locale, [
          { name: dict.footer.docs, path: PATH },
          { name: page.title, path: PATH },
        ])}
      />

      <PageHeader
        locale={locale}
        title={page.title}
        intro={page.intro}
        trail={[{ label: dict.footer.docs }, { label: page.title }]}
      />

      <div className="ant-container py-16 lg:py-20">
        <div className="lg:grid lg:grid-cols-[minmax(0,45rem)_14rem] lg:items-start lg:gap-16">
          <div>
            <section id={overviewId} className="scroll-mt-28">
              <div className="flex flex-wrap gap-2">
                {page.chips.map((chip) => (
                  <Pill key={chip} tone="muted">
                    {chip}
                  </Pill>
                ))}
              </div>

              <aside className="mt-8 border-l-2 border-warn pl-4">
                <p className="font-sans text-detail-s font-medium text-ink">{page.tabWarningTitle}</p>
                <p className="mt-2 text-paragraph-xs text-ink-secondary">{page.tabWarningBody}</p>
              </aside>

              <Reveal>
                <div className="mt-10">
                  <CodeBlock code={SAMPLE_NETSCAPE} caption="cookies.txt" />
                </div>
              </Reveal>
            </section>

            <section id={fieldsId} className="mt-16 scroll-mt-28">
              <Reveal>
                <h2 className="text-display-s sm:text-display-m">{page.fieldsTitle}</h2>
              </Reveal>

              <Reveal delay={0.05}>
                <div className="ant-scroll mt-8 overflow-x-auto">
                  <table className="w-full min-w-[46rem] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-line">
                        <th className="py-3 pr-4 font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
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
                          <td className="py-4 pr-4 font-mono text-detail-xs text-ink-faint">
                            {i + 1}
                          </td>
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
            </section>

            <section id={httpOnlyId} className="mt-16 scroll-mt-28">
              <Reveal>
                <h2 className="text-display-s sm:text-display-m">{page.httpOnlyTitle}</h2>
                <p className="mt-6 text-paragraph-xs text-ink-secondary">{page.httpOnlyBody}</p>
              </Reveal>
            </section>

            <section id={gotchasId} className="mt-16 scroll-mt-28">
              <Reveal>
                <h2 className="text-display-s sm:text-display-m">{page.gotchasTitle}</h2>
              </Reveal>
              <ul className="mt-8 flex flex-col gap-5">
                {page.gotchas.map((gotcha, i) => (
                  <Reveal key={gotcha} delay={i * 0.04}>
                    <li className="flex gap-4 border-t border-line pt-5">
                      <span
                        aria-hidden
                        className="mt-[0.6rem] size-1.5 shrink-0 rounded-round bg-clay"
                      />
                      <p className="text-paragraph-xs text-ink-secondary">{gotcha}</p>
                    </li>
                  </Reveal>
                ))}
              </ul>
            </section>

            <section id={toolsId} className="mt-16 scroll-mt-28">
              <Reveal>
                <h2 className="text-display-s sm:text-display-m">{page.toolsTitle}</h2>
              </Reveal>
              <dl className="mt-8 flex flex-col gap-6">
                {page.tools.map((tool, i) => (
                  <Reveal key={tool.name} delay={i * 0.04}>
                    <div>
                      <dt className="font-mono text-detail-s text-clay">{tool.name}</dt>
                      <dd className="mt-1 text-paragraph-xs text-ink-secondary">{tool.body}</dd>
                    </div>
                  </Reveal>
                ))}
              </dl>
            </section>

            <Reveal>
              <div className="mt-16 rounded-large border border-line bg-bg-secondary p-8">
                <p className="text-paragraph-s">{dict.common.tryIt}</p>
                <a
                  href={localePath(locale, '/')}
                  className="mt-5 inline-flex h-11 items-center rounded-main bg-invert px-5 font-sans text-detail-m font-medium text-invert-ink transition-colors duration-200 ease-ant hover:bg-invert-hover"
                >
                  {dict.footer.converter}
                </a>
                <p className="mt-5 font-sans text-detail-s text-ink-secondary">
                  {dict.common.tryApi}{' '}
                  <a href={localePath(locale, '/api')} className="ant-link text-ink">
                    {dict.common.tryApiLink}
                  </a>
                </p>
              </div>
            </Reveal>
          </div>

          <GuideToc label={dict.common.onThisPage} items={toc} />
        </div>
      </div>
    </>
  )
}
