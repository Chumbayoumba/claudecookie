import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CredentialTool } from '@/components/credential/CredentialTool'
import { Terminal } from '@/components/guide/Terminal'
import { PageHeader } from '@/components/layout/PageHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { PageEnter } from '@/components/ui/PageEnter'
import { Reveal } from '@/components/ui/Reveal'
import { getDictionary } from '@/lib/i18n'
import { LOCALES, isLocale, localePath, type Locale } from '@/lib/i18n/config'
import { buildBreadcrumbJsonLd, buildMetadata } from '@/lib/seo'

const PATH = '/credential'

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
    title: dict.meta.credential.title,
    description: dict.meta.credential.description,
  })
}

export default async function CredentialPage({ params }: PageProps) {
  const { locale: raw } = await params
  if (!isLocale(raw)) notFound()

  const locale = raw as Locale
  const dict = getDictionary(locale)
  const page = dict.pages.credential

  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd(locale, [
          { name: dict.common.tools, path: '/' },
          { name: dict.footer.credentials, path: PATH },
        ])}
      />

      <PageHeader
        locale={locale}
        title={page.title}
        intro={page.intro}
        trail={[
          { href: '/', label: dict.common.tools },
          { label: dict.footer.credentials },
        ]}
      />

      <section className="ant-container pt-8 pb-12 lg:pt-10 lg:pb-16">
        <PageEnter>
          <div className="max-w-3xl">
            <CredentialTool locale={locale} dict={dict} />
          </div>
        </PageEnter>
      </section>

      <section className="ant-container pb-8">
        <div className="mx-auto max-w-2xl">
          <Terminal
            title="claude credentials"
            lines={[
              { k: 'cmt', t: '# after convert: ~/.claude/.credentials.json' },
              { k: 'ok', t: '✔ session verified — you@example.com · Claude Max' },
              { k: 'out', t: 'wrote claudeAiOauth { accessToken, refreshToken, expiresAt }' },
              { k: 'cmd', t: 'claude' },
              { k: 'ok', t: '✔ Logged in as you@example.com — Claude Max' },
            ]}
          />
        </div>
      </section>

      <div className="ant-container pb-16 lg:pb-20">
        <Reveal delay={0.1}>
          <p className="max-w-[70ch] text-paragraph-xs text-ink-secondary">
            {page.note}{' '}
            <a href={localePath(locale, '/privacy')} className="ant-link text-ink hover:text-ink">
              {dict.check.privacyLink}
            </a>
            .
          </p>
        </Reveal>
      </div>
    </>
  )
}
