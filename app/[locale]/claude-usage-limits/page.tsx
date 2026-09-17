import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GuidePage } from '@/components/guide/GuidePage'
import { Terminal } from '@/components/guide/Terminal'
import { getDictionary } from '@/lib/i18n'
import { LOCALES, isLocale, type Locale } from '@/lib/i18n/config'
import { buildMetadata } from '@/lib/seo'

const PATH = '/claude-usage-limits'
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
    title: dict.meta.claudeUsage.title,
    description: dict.meta.claudeUsage.description,
  })
}

export default async function ClaudeUsageLimitsPage({ params }: PageProps) {
  const { locale: raw } = await params
  if (!isLocale(raw)) notFound()

  const locale = raw as Locale
  const dict = getDictionary(locale)

  return (
    <GuidePage
      locale={locale}
      path={PATH}
      guide={dict.pages.claudeUsage}
      description={dict.meta.claudeUsage.description}
      datePublished={PUBLISHED}
      ctaPath="/check"
      crumbConverter={dict.footer.converter}
      updatedLabel={dict.pages.privacy.updated}
      backLabel={dict.common.backToConverter}
      illustration={
        <Terminal
          title="claude — usage"
          lines={[
            { k: 'cmd', t: 'claude' },
            { k: 'err', t: '✗ Claude usage limit reached. Your limit will reset at 3:00 PM.' },
            { k: 'cmd', t: '/cost' },
            { k: 'out', t: 'Session: 2.1M tokens · $0.00 (subscription)' },
            { k: 'out', t: '  5-hour window   ▓▓▓▓▓▓▓▓▓▓ 100%  · resets 15:00' },
            { k: 'out', t: '  weekly window   ▓▓▓▓▓▓▓░░░  71%  · resets Sat 00:30' },
            { k: 'cmt', t: '# shared across claude.ai · Claude Code · Desktop' },
          ]}
        />
      }
    />
  )
}
