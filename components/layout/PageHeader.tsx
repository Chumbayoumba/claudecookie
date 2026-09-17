import { PageEnter } from '@/components/ui/PageEnter'
import { localePath, type Locale } from '@/lib/i18n/config'

export interface Crumb {
  href?: string
  label: string
}

interface PageHeaderProps {
  locale: Locale
  title: string
  intro: string
  trail: Crumb[]
  badge?: string
  meta?: string
}

export function PageHeader({ locale, title, intro, trail, badge, meta }: PageHeaderProps) {
  return (
    <header className="ant-container border-b border-line pt-12 pb-12 sm:pt-16">
      <PageEnter>
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {trail.map((crumb, i) => {
            const last = i === trail.length - 1
            return (
              <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-2">
                {i > 0 ? (
                  <span aria-hidden className="font-sans text-detail-s text-ink-faint">
                    /
                  </span>
                ) : null}
                {crumb.href && !last ? (
                  <a
                    href={crumb.href.startsWith('http') ? crumb.href : localePath(locale, crumb.href)}
                    className="ant-link font-sans text-detail-s text-ink-secondary hover:text-ink"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span
                    className="font-sans text-detail-s text-ink-secondary"
                    aria-current={last ? 'page' : undefined}
                  >
                    {crumb.label}
                  </span>
                )}
              </span>
            )
          })}
        </nav>
      </PageEnter>

      {badge ? (
        <PageEnter delay={0.02}>
          <p className="mt-6 font-sans text-detail-xs font-semibold tracking-[0.12em] text-clay uppercase">
            {badge}
          </p>
        </PageEnter>
      ) : null}

      <PageEnter delay={badge ? 0.04 : 0.02}>
        <h1 className="mt-6 max-w-3xl text-display-m sm:text-display-l">{title}</h1>
      </PageEnter>
      <PageEnter delay={badge ? 0.06 : 0.04}>
        <p className="mt-6 max-w-2xl text-paragraph-xs text-ink-secondary sm:text-paragraph-s">
          {intro}
        </p>
      </PageEnter>
      {meta ? (
        <PageEnter delay={badge ? 0.08 : 0.06}>
          <p className="mt-3 max-w-2xl font-sans text-detail-s text-ink-faint">{meta}</p>
        </PageEnter>
      ) : null}
    </header>
  )
}
