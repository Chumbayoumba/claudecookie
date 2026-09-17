import { Checker } from './Checker'
import { PageEnter } from '@/components/ui/PageEnter'
import { ToolShell } from '@/components/ui/ToolShell'
import { localePath, type Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

interface CheckIntroProps {
  locale: Locale
  dict: Dictionary
}

export function CheckIntro({ locale, dict }: CheckIntroProps) {
  return (
    <ToolShell>
      <PageEnter delay={0.16}>
        <div className="max-w-3xl">
          <Checker locale={locale} dict={dict} />
          <p className="mt-6 max-w-[70ch] text-detail-s text-ink-faint">
            {dict.check.privacyNote}{' '}
            <a
              href={localePath(locale, '/privacy')}
              className="ant-link text-ink-secondary hover:text-ink"
            >
              {dict.check.privacyLink}
            </a>
            .
          </p>
        </div>
      </PageEnter>
    </ToolShell>
  )
}
