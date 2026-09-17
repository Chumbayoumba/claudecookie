import { localePath, type Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { cn } from '@/lib/utils/cn'

interface ToolSwitchProps {
  locale: Locale
  dict: Dictionary
  pathname: string
  compact?: boolean
}

function ConvertIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <path
        d="M5 5h6L9 3M11 11H5l2 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="m5.5 8.2 1.8 1.8L10.7 6.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <circle cx="6" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8.2 8h4.3v2.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function samePath(pathname: string, href: string) {
  const norm = (value: string) => {
    let path = value === '/' ? '/' : `${value.replace(/\/+$/, '')}/`
    if (path.startsWith('/en/')) path = path.slice(3) || '/'
    return path
  }
  return norm(pathname) === norm(href)
}

export function ToolSwitch({ locale, dict, pathname, compact }: ToolSwitchProps) {
  const tools = [
    { href: localePath(locale, '/'), label: dict.nav.convertShort, Icon: ConvertIcon },
    { href: localePath(locale, '/check'), label: dict.nav.checkShort, Icon: CheckIcon },
    { href: localePath(locale, '/credential'), label: dict.nav.credentialsShort, Icon: KeyIcon },
  ]

  return (
    <div
      role="navigation"
      aria-label={dict.footer.tools}
      className={cn(
        'flex items-center rounded-main border border-line bg-bg-secondary p-0.5',
        compact && 'w-full',
      )}
    >
      {tools.map((tool) => {
        const active = samePath(pathname, tool.href)
        return (
          <a
            key={tool.href}
            href={tool.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-small px-2.5 py-1.5',
              'font-sans text-detail-s font-medium transition-colors duration-200 ease-ant',
              compact && 'flex-1',
              active
                ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--ant-border)]'
                : 'text-ink-secondary hover:text-ink',
            )}
          >
            <tool.Icon />
            {tool.label}
          </a>
        )
      })}
    </div>
  )
}
