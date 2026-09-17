import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GuidePage } from '@/components/guide/GuidePage'
import { Terminal } from '@/components/guide/Terminal'
import { getDictionary } from '@/lib/i18n'
import { LOCALES, isLocale, type Locale } from '@/lib/i18n/config'
import { buildMetadata } from '@/lib/seo'

const PATH = '/claude-code-login'
const PUBLISHED = '2026-09-14'

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
    title: dict.meta.claudeCodeLogin.title,
    description: dict.meta.claudeCodeLogin.description,
  })
}

export default async function ClaudeCodeLoginPage({ params }: PageProps) {
  const { locale: raw } = await params
  if (!isLocale(raw)) notFound()

  const locale = raw as Locale
  const dict = getDictionary(locale)

  return (
    <GuidePage
      locale={locale}
      path={PATH}
      guide={dict.pages.claudeCodeLogin}
      description={dict.meta.claudeCodeLogin.description}
      datePublished={PUBLISHED}
      ctaPath="/check"
      homeLabel={dict.common.home}
      guidesLabel={dict.nav.guides}
      badge={dict.common.guideBadge}
      onThisPage={dict.common.onThisPage}
      updatedLabel={dict.pages.privacy.updated}
      illustration={
        <Terminal
          title="claude — session fix"
          lines={[
            { k: 'cmd', t: 'claude' },
            { k: 'err', t: '✗ Your session has expired. Please run /login to sign in again.' },
            { k: 'cmt', t: '# first, make sure no API key is overriding the subscription:' },
            { k: 'cmd', t: 'echo $ANTHROPIC_API_KEY' },
            { k: 'out', t: 'sk-ant-api03-…   ← unset this if you meant to use Pro/Max' },
            { k: 'cmd', t: '/logout' },
            { k: 'out', t: 'Logged out. Cleared ~/.claude/.credentials.json.' },
            { k: 'cmd', t: '/login' },
            { k: 'out', t: 'Opening browser to authenticate…' },
            { k: 'ok', t: '✔ Logged in as you@example.com — Claude Pro' },
          ]}
        />
      }
    />
  )
}
