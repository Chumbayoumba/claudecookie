import { localePath, type Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { cn } from '@/lib/utils/cn'

interface ToolSwitchProps {
  locale: Locale
  dict: Dictionary
  pathname: string
  compact?: boolean
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
    { href: localePath(locale, '/'), label: dict.nav.convertShort },
    { href: localePath(locale, '/check'), label: dict.nav.checkShort },
    { href: localePath(locale, '/credential'), label: dict.nav.credentialsShort },
  ]

  return (
    <div
      role="navigation"
      aria-label={dict.footer.tools}
      className={cn('flex', compact ? 'w-full flex-col gap-1' : 'items-center gap-0.5')}
    >
      {tools.map((tool) => {
        const active = samePath(pathname, tool.href)
        return (
          <a
            key={tool.href}
            href={tool.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'font-sans font-medium transition-colors duration-200 ease-ant',
              compact
                ? 'rounded-main px-3 py-3 text-detail-l'
                : 'rounded-small px-2.5 py-1.5 text-detail-s',
              active ? 'bg-clay/6 text-ink' : 'text-ink-secondary hover:text-ink',
            )}
          >
            {tool.label}
          </a>
        )
      })}
    </div>
  )
}
