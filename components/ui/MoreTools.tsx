import { GoalLink } from '@/components/analytics/GoalLink'
import {
  ProductIconApi,
  ProductIconCheck,
  ProductIconCredential,
} from '@/components/ui/ProductIcons'
import { localePath, type Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

interface MoreToolsProps {
  locale: Locale
  dict: Dictionary
  /** Hide the card that points at the page the visitor is already on. */
  omit?: '/check' | '/credential' | '/api'
}

export function MoreTools({ locale, dict, omit }: MoreToolsProps) {
  const items = [
    {
      path: '/check',
      href: localePath(locale, '/check'),
      goal: 'checker_cta_click',
      title: dict.moreTools.checkTitle,
      body: dict.moreTools.checkBody,
      cta: dict.moreTools.checkCta,
      Icon: ProductIconCheck,
    },
    {
      path: '/credential',
      href: localePath(locale, '/credential'),
      goal: 'credential_cta_click',
      title: dict.moreTools.credTitle,
      body: dict.moreTools.credBody,
      cta: dict.moreTools.credCta,
      Icon: ProductIconCredential,
    },
    {
      path: '/api',
      href: localePath(locale, '/api'),
      goal: 'api_cta_click',
      title: dict.moreTools.apiTitle,
      body: dict.moreTools.apiBody,
      cta: dict.moreTools.apiCta,
      Icon: ProductIconApi,
    },
  ].filter((item) => item.path !== omit)

  const columns = items.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'

  return (
    <section className="ant-container pb-4" aria-label={dict.moreTools.title}>
      <h2 className="text-display-xs sm:text-display-s">{dict.moreTools.title}</h2>
      <div className={`mt-6 grid gap-4 ${columns}`}>
        {items.map((item) => (
          <GoalLink
            key={item.href}
            href={item.href}
            goal={item.goal}
            className="group flex flex-col rounded-large border border-line bg-bg p-5 no-underline transition-colors duration-200 ease-ant hover:border-line-strong hover:bg-surface"
          >
            <item.Icon className="size-5 text-ink-secondary" />
            <h3 className="mt-4 font-sans text-detail-l font-medium text-ink">{item.title}</h3>
            <p className="mt-2 text-paragraph-xs text-ink-secondary">{item.body}</p>
            <span className="mt-4 font-sans text-detail-s text-ink-faint transition-colors duration-200 ease-ant group-hover:text-ink">
              {item.cta}
            </span>
          </GoalLink>
        ))}
      </div>
    </section>
  )
}
