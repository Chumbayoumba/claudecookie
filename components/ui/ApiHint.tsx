import { localePath, type Locale } from '@/lib/i18n/config'

interface ApiHintProps {
  locale: Locale
  hint: string
  link: string
  className?: string
}

/** One-line pointer from a tool page to the public API docs. */
export function ApiHint({ locale, hint, link, className = 'mt-6' }: ApiHintProps) {
  return (
    <p className={`${className} max-w-3xl font-sans text-detail-s text-ink-secondary`}>
      {hint}{' '}
      <a href={localePath(locale, '/api')} className="ant-link text-ink">
        {link}
      </a>
    </p>
  )
}
