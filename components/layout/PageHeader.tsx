import { localePath, type Locale } from '@/lib/i18n/config'

interface PageHeaderProps {
  locale: Locale
  title: string
  intro: string
  backLabel: string
}

/** Shared masthead for the reference pages: breadcrumb, heading, standfirst. */
export function PageHeader({ locale, title, intro, backLabel }: PageHeaderProps) {
  return (
    <header className="ant-container border-b border-line pt-12 pb-12 sm:pt-16">
      <a
        href={localePath(locale, '/')}
        className="ant-link inline-flex items-center gap-1.5 font-sans text-detail-s text-ink-secondary hover:text-ink"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
          <path
            d="M9.5 3.5 5 8l4.5 4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {backLabel}
      </a>

      <h1 className="mt-6 max-w-3xl text-display-m sm:text-display-l">{title}</h1>
      <p className="mt-6 max-w-2xl text-paragraph-xs text-ink-secondary sm:text-paragraph-s">
        {intro}
      </p>
    </header>
  )
}
