import { GoalLink } from '@/components/analytics/GoalLink'
import { CopyButton } from '@/components/api/CopyButton'
import { GuideToc } from '@/components/guide/GuideToc'
import { Terminal } from '@/components/guide/Terminal'
import { sectionId } from '@/components/guide/sectionId'
import { PageHeader } from '@/components/layout/PageHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { Accordion } from '@/components/ui/Accordion'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { Reveal } from '@/components/ui/Reveal'
import { getDictionary } from '@/lib/i18n'
import { SITE_URL, localePath, localeUrl, type Locale } from '@/lib/i18n/config'
import { buildGuideJsonLd } from '@/lib/seo'

const CURL = {
  convert: `curl https://claudecookie.com/api/v1/convert \\
  -H 'Content-Type: application/json' \\
  -d '{"input":".claude.ai\\tTRUE\\t/\\tTRUE\\t0\\tsessionKey\\tsk-ant-sid01-…","target":"cookie-editor"}'`,
  check: `curl https://claudecookie.com/api/v1/check \\
  -H 'Content-Type: application/json' \\
  -d '{"cookie":"sessionKey=sk-ant-sid01-…"}'`,
  credential: `curl https://claudecookie.com/api/v1/credential \\
  -H 'Content-Type: application/json' \\
  -d '{"cookie":"sessionKey=sk-ant-sid01-…"}'`,
  health: 'curl https://claudecookie.com/api/v1/health',
}

export function ApiDocsPage({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale)
  const page = dict.pages.api
  const description = dict.meta.api.description
  const path = '/api'
  const convertId = sectionId(page.convertTitle, 0)
  const checkId = sectionId(page.checkTitle, 1)
  const credentialId = sectionId(page.credentialTitle, 2)
  const healthId = sectionId(page.healthTitle, 3)
  const limitsId = sectionId(page.limitsTitle, 4)
  const reasonsId = sectionId(page.reasonsTitle, 5)
  const sourcesId = sectionId(page.sourcesTitle, 90)
  const faqId = 'faq'

  const toc = [
    { id: convertId, title: page.convertTitle },
    { id: checkId, title: page.checkTitle },
    { id: credentialId, title: page.credentialTitle },
    { id: healthId, title: page.healthTitle },
    { id: limitsId, title: page.limitsTitle },
    { id: reasonsId, title: page.reasonsTitle },
    { id: sourcesId, title: page.sourcesTitle },
    { id: faqId, title: page.faqTitle },
  ]

  const jsonLd = buildGuideJsonLd({
    locale,
    path,
    headline: page.title,
    description,
    datePublished: '2026-09-18',
    dateModified: page.updated,
    faq: page.faq,
    trail: [
      { name: dict.nav.docs, path: '/formats/netscape-cookies-txt' },
      { name: page.title, path },
    ],
  })

  const sources = [
    { label: page.openapiLabel, url: `${SITE_URL}/openapi.json` },
    { label: dict.nav.check, url: localeUrl(locale, '/check') },
    { label: dict.nav.getCredential, url: localeUrl(locale, '/credential') },
    { label: dict.nav.privacy, url: localeUrl(locale, '/privacy') },
  ]

  return (
    <>
      <JsonLd data={jsonLd} />

      <PageHeader
        locale={locale}
        title={page.title}
        intro={page.intro}
        badge={page.badge}
        trail={[{ label: dict.nav.docs }, { label: page.title }]}
      />

      <article className="ant-container pt-6 pb-16 lg:pb-24">
        <div className="lg:grid lg:grid-cols-[minmax(0,45rem)_14rem] lg:items-start lg:gap-16">
          <div className="max-w-[45rem]">
            <p className="font-sans text-detail-xs text-ink-faint">
              {page.readMinutes} {dict.common.minRead} · {page.updated}
            </p>

            <Reveal>
              <div className="mt-8">
                <Terminal
                  title="claudecookie API"
                  lines={[
                    { k: 'cmt', t: '# no key — HTTPS JSON, same results as the website' },
                    { k: 'cmd', t: 'curl https://claudecookie.com/api/v1/health' },
                    { k: 'ok', t: '{ "ok": true }' },
                    { k: 'cmd', t: 'curl https://claudecookie.com/api/v1/check -d \'{"cookie":"…"}\'' },
                    { k: 'out', t: '{ "ok": true, "planLabel": "Claude Pro", "session": { "percent": 12 } }' },
                  ]}
                />
              </div>
            </Reveal>

            <Endpoint
              id={convertId}
              title={page.convertTitle}
              body={page.convertBody}
              caption={page.convertCaption}
              code={CURL.convert}
              copyLabel={page.copyCurl}
              copiedLabel={page.copied}
            />
            <Endpoint
              id={checkId}
              title={page.checkTitle}
              body={page.checkBody}
              caption={page.checkCaption}
              code={CURL.check}
              copyLabel={page.copyCurl}
              copiedLabel={page.copied}
            />
            <Endpoint
              id={credentialId}
              title={page.credentialTitle}
              body={page.credentialBody}
              caption={page.credentialCaption}
              code={CURL.credential}
              copyLabel={page.copyCurl}
              copiedLabel={page.copied}
            />
            <Endpoint
              id={healthId}
              title={page.healthTitle}
              body={page.healthBody}
              caption={page.healthCaption}
              code={CURL.health}
              copyLabel={page.copyCurl}
              copiedLabel={page.copied}
            />

            <Reveal>
              <section id={limitsId} className="mt-10 scroll-mt-28">
                <h2 className="text-display-xs sm:text-display-s">{page.limitsTitle}</h2>
                <p className="mt-4 text-paragraph-xs text-ink-secondary sm:text-paragraph-s">
                  {page.limitsIntro}
                </p>
                <KeyTable rows={page.limits} nameHeader={page.limitName} valueHeader={page.limitValue} />
              </section>
            </Reveal>

            <Reveal>
              <section id={reasonsId} className="mt-10 scroll-mt-28">
                <h2 className="text-display-xs sm:text-display-s">{page.reasonsTitle}</h2>
                <p className="mt-4 text-paragraph-xs text-ink-secondary sm:text-paragraph-s">
                  {page.reasonsIntro}
                </p>
                <KeyTable
                  rows={page.reasons.map((row) => ({ name: row.code, value: row.meaning }))}
                  nameHeader={page.reasonCode}
                  valueHeader={page.reasonMeaning}
                  monoName
                />
              </section>
            </Reveal>

            <Reveal>
              <section id={sourcesId} className="mt-12 scroll-mt-28 border-t border-line pt-8">
                <h2 className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
                  {page.sourcesTitle}
                </h2>
                <ul className="mt-4 flex flex-col gap-2">
                  {sources.map((source) => (
                    <li key={source.url}>
                      <a
                        href={source.url}
                        className="ant-link font-sans text-detail-s text-ink-secondary hover:text-ink"
                      >
                        {source.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          </div>

          <GuideToc label={dict.common.onThisPage} items={toc} />
        </div>

        <div id={faqId} className="mt-14 max-w-[45rem] scroll-mt-28">
          <Reveal>
            <h2 className="text-display-s sm:text-display-m">{page.faqTitle}</h2>
          </Reveal>
          <Reveal delay={0.06}>
            <div className="mt-8">
              <Accordion items={page.faq} />
            </div>
          </Reveal>
        </div>

        <Reveal>
          <div className="mt-14 flex max-w-[45rem] flex-col gap-5 rounded-large border border-line bg-bg-secondary p-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-display-xs">{page.ctaTitle}</h2>
              <p className="mt-2 text-paragraph-xs text-ink-secondary">{page.ctaBody}</p>
            </div>
            <GoalLink
              href={localePath(locale, '/check')}
              goal="guide_cta_click"
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-main bg-clay px-6 font-sans text-detail-l font-medium whitespace-nowrap text-clay-contrast transition-colors duration-200 ease-ant hover:bg-clay-hover"
            >
              {page.ctaLabel}
            </GoalLink>
          </div>
        </Reveal>
      </article>
    </>
  )
}

function Endpoint({
  id,
  title,
  body,
  caption,
  code,
  copyLabel,
  copiedLabel,
}: {
  id: string
  title: string
  body: string
  caption: string
  code: string
  copyLabel: string
  copiedLabel: string
}) {
  return (
    <Reveal>
      <section id={id} className="mt-10 scroll-mt-28">
        <h2 className="text-display-xs sm:text-display-s">{title}</h2>
        {body.split('\n\n').map((para) => (
          <p key={para} className="mt-4 text-paragraph-xs text-ink-secondary sm:text-paragraph-s">
            {para}
          </p>
        ))}
        <div className="relative mt-5">
          <CodeBlock code={code} caption={caption} />
          <CopyButton text={code} copyLabel={copyLabel} copiedLabel={copiedLabel} />
        </div>
      </section>
    </Reveal>
  )
}

function KeyTable({
  rows,
  nameHeader,
  valueHeader,
  monoName = false,
}: {
  rows: { name: string; value: string }[]
  nameHeader: string
  valueHeader: string
  monoName?: boolean
}) {
  return (
    <div className="mt-6 overflow-hidden rounded-large border border-line">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-line bg-bg-secondary">
            <th className="px-4 py-2.5 font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
              {nameHeader}
            </th>
            <th className="px-4 py-2.5 font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
              {valueHeader}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.name}>
              <td
                className={
                  monoName
                    ? 'px-4 py-3 align-top font-mono text-detail-xs text-ink'
                    : 'px-4 py-3 align-top font-sans text-detail-s text-ink'
                }
              >
                {row.name}
              </td>
              <td className="px-4 py-3 text-paragraph-xs text-ink-secondary">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
