import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { JsonFormatTabs } from '@/components/formats/JsonFormatTabs'
import { PageHeader } from '@/components/layout/PageHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { Reveal } from '@/components/ui/Reveal'
import { convert, type CookieFormat } from '@/lib/cookies'
import { SAMPLE_NETSCAPE } from '@/lib/cookies/samples'
import { getDictionary } from '@/lib/i18n'
import { LOCALES, isLocale, localePath, type Locale } from '@/lib/i18n/config'
import { buildBreadcrumbJsonLd, buildMetadata } from '@/lib/seo'
import { cn } from '@/lib/utils/cn'

const PATH = '/formats/json-cookies'

/** Which attributes each format is capable of carrying. Drives the matrix table. */
const CAPABILITIES: Record<string, { domain: boolean; expiry: boolean; flags: boolean }> = {
  'cookie-editor': { domain: true, expiry: true, flags: true },
  puppeteer: { domain: true, expiry: true, flags: true },
  'key-value': { domain: false, expiry: false, flags: false },
  header: { domain: false, expiry: false, flags: false },
}

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
    title: dict.meta.json.title,
    description: dict.meta.json.description,
  })
}

export default async function JsonFormatsPage({ params }: PageProps) {
  const { locale: raw } = await params
  if (!isLocale(raw)) notFound()

  const locale = raw as Locale
  const dict = getDictionary(locale)
  const page = dict.pages.json

  /*
   * The samples are produced by running the converter itself over one shared
   * Netscape file at build time, so the documentation can never drift away from
   * what the tool actually emits.
   */
  const samples = Object.fromEntries(
    (['cookie-editor', 'puppeteer', 'key-value', 'header'] as CookieFormat[]).map((format) => [
      format,
      convert(SAMPLE_NETSCAPE, { target: format }).output,
    ]),
  ) as Record<string, string>

  const Tick = ({ on }: { on: boolean }) => (
    <span
      className={cn('font-sans text-detail-s', on ? 'text-ok' : 'text-ink-faint')}
      aria-label={on ? dict.common.yes : dict.common.no}
    >
      {on ? dict.common.yes : dict.common.no}
    </span>
  )

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd(locale, [
          { name: dict.footer.docs, path: '/formats/netscape-cookies-txt' },
          { name: dict.common.cookieFormats, path: PATH },
          { name: page.title, path: PATH },
        ])}
      />

      <PageHeader
        locale={locale}
        title={page.title}
        intro={page.intro}
        trail={[
          { label: dict.footer.docs },
          { label: dict.common.cookieFormats },
          { label: page.title },
        ]}
      />

      <div className="ant-container py-16 lg:py-20">
        <div className="max-w-[var(--container-prose)]">
          <Reveal>
            <h2 className="text-display-s sm:text-display-m">{page.mappingTitle}</h2>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="ant-scroll mt-8 overflow-x-auto rounded-large border border-line">
              <table className="w-full min-w-[34rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line bg-bg-secondary">
                    {[
                      dict.common.format,
                      dict.common.storesDomain,
                      dict.common.storesExpiry,
                      dict.common.storesFlags,
                    ].map((head) => (
                      <th
                        key={head}
                        className="px-4 py-3 font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase"
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {page.entries.map((entry) => {
                    const caps = CAPABILITIES[entry.id] ?? {
                      domain: false,
                      expiry: false,
                      flags: false,
                    }
                    return (
                      <tr key={entry.id}>
                        <td className="px-4 py-4 font-sans text-detail-s font-medium whitespace-nowrap text-ink">
                          {entry.title}
                        </td>
                        <td className="px-4 py-4">
                          <Tick on={caps.domain} />
                        </td>
                        <td className="px-4 py-4">
                          <Tick on={caps.expiry} />
                        </td>
                        <td className="px-4 py-4">
                          <Tick on={caps.flags} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>

        <Reveal>
          <h2 className="mt-16 text-display-s sm:text-display-m">{page.formatsTitle}</h2>
        </Reveal>

        <Reveal>
          <div className="mt-10">
            <JsonFormatTabs
              usedByLabel={dict.common.usedBy}
              exampleLabel={dict.common.example}
              yesLabel={dict.common.yes}
              noLabel={dict.common.no}
              tabs={page.entries.map((entry) => {
                const caps = CAPABILITIES[entry.id] ?? {
                  domain: false,
                  expiry: false,
                  flags: false,
                }
                return {
                  id: entry.id,
                  label: entry.tab,
                  title: entry.title,
                  body: entry.body,
                  usedBy: entry.usedBy,
                  code: (samples[entry.id] ?? '').trimEnd(),
                  syntax: entry.id === 'header' ? 'text' : 'json',
                  capabilities: [
                    { label: dict.common.storesDomain, on: caps.domain },
                    { label: dict.common.storesExpiry, on: caps.expiry },
                    { label: dict.common.storesFlags, on: caps.flags },
                  ],
                }
              })}
            />
          </div>
        </Reveal>

        <div className="max-w-[var(--container-prose)]">
          <Reveal>
            <h2 className="mt-16 text-display-s sm:text-display-m">{page.lossTitle}</h2>
            <p className="mt-6 max-w-[62ch] text-paragraph-xs text-ink-secondary">
              {page.lossBody}
            </p>
          </Reveal>

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
      </div>
    </>
  )
}
