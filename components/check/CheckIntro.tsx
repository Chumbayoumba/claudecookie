import { Checker } from './Checker'
import { Reveal } from '@/components/ui/Reveal'
import { localePath, type Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

interface CheckIntroProps {
  locale: Locale
  dict: Dictionary
}

export function CheckIntro({ locale, dict }: CheckIntroProps) {
  return (
    <div className="flex flex-col gap-16 lg:gap-24">
      <div className="max-w-3xl">
        <Checker locale={locale} dict={dict} />
      </div>

      <Reveal>
        <h2 className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
          {dict.check.readsTitle}
        </h2>
        <div className="mt-6 grid gap-px overflow-hidden rounded-large border border-line bg-line sm:grid-cols-3">
          {dict.check.reads.map((item) => (
            <div key={item.title} className="flex h-full flex-col bg-bg p-6">
              <h3 className="font-sans text-detail-l font-medium text-ink">{item.title}</h3>
              <p className="mt-2 text-paragraph-xs text-ink-secondary">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-large border border-line bg-bg-secondary p-6">
          <h3 className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
            {dict.check.formatsTitle}
          </h3>
          <p className="mt-3 max-w-[70ch] text-paragraph-xs text-ink-secondary">
            {dict.check.formatsBody}
          </p>
          <p className="mt-4 max-w-[70ch] text-detail-s text-ink-faint">
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
      </Reveal>
    </div>
  )
}
