import { Checker } from './Checker'
import { PageEnter } from '@/components/ui/PageEnter'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

interface CheckIntroProps {
  locale: Locale
  dict: Dictionary
}

export function CheckIntro({ locale, dict }: CheckIntroProps) {
  return (
    <PageEnter>
      <div className="max-w-3xl">
        <Checker locale={locale} dict={dict} />
      </div>
    </PageEnter>
  )
}
