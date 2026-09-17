'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LanguageSwitcher } from './LanguageSwitcher'
import { Logo, Wordmark } from './Logo'
import { NavMenu } from './NavMenu'
import { ThemeToggle } from './ThemeToggle'
import { ToolSwitch } from './ToolSwitch'
import { localePath, type Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { cn } from '@/lib/utils/cn'

function samePath(pathname: string, href: string) {
  const norm = (value: string) => {
    let path = value === '/' ? '/' : `${value.replace(/\/+$/, '')}/`
    if (path.startsWith('/en/')) path = path.slice(3) || '/'
    return path
  }
  return norm(pathname) === norm(href)
}

interface HeaderProps {
  locale: Locale
  dict: Dictionary
}

export function Header({ locale, dict }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setMenuOpen(false), [pathname])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const docs = [
    { href: localePath(locale, '/formats/netscape-cookies-txt'), label: dict.nav.netscapeFormat },
    { href: localePath(locale, '/formats/json-cookies'), label: dict.nav.jsonFormat },
  ]
  const guides = [
    { href: localePath(locale, '/claude-code-login'), label: dict.nav.claudeCodeLogin },
    { href: localePath(locale, '/claude-usage-limits'), label: dict.nav.claudeUsage },
  ]

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,border-color] duration-300 ease-ant',
        'border-b bg-bg/80 backdrop-blur-md',
        scrolled ? 'border-line' : 'border-transparent',
      )}
    >
      <div className="ant-container flex h-16 items-center justify-between gap-3">
        <a
          href={localePath(locale, '/')}
          className="flex items-center gap-2.5 text-ink transition-opacity duration-200 ease-ant hover:opacity-70"
        >
          <Logo className="text-clay" />
          <Wordmark />
        </a>

        <div className="hidden items-center gap-2 xl:flex">
          <ToolSwitch locale={locale} dict={dict} pathname={pathname} />
          <nav aria-label="Main" className="flex items-center gap-0.5">
            <NavMenu label={dict.nav.docs} items={docs} />
            <NavMenu label={dict.nav.guides} items={guides} />
            <a
              href={localePath(locale, '/privacy')}
              className={cn(
                'rounded-main px-3 py-2 font-sans text-detail-s font-medium',
                'transition-colors duration-200 ease-ant hover:bg-surface-hover',
                samePath(pathname, localePath(locale, '/privacy'))
                  ? 'text-ink'
                  : 'text-ink-secondary hover:text-ink',
              )}
            >
              {dict.nav.privacy}
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <div className="hidden sm:block">
            <LanguageSwitcher locale={locale} label={dict.nav.language} />
          </div>
          <ThemeToggle
            labels={{
              theme: dict.nav.theme,
              light: dict.nav.themeLight,
              dark: dict.nav.themeDark,
            }}
          />
          <button
            type="button"
            aria-label={menuOpen ? dict.nav.closeMenu : dict.nav.openMenu}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              'grid size-9 cursor-pointer place-items-center rounded-main xl:hidden',
              'text-ink-secondary transition-colors duration-200 ease-ant',
              'hover:bg-surface-hover hover:text-ink',
            )}
          >
            <span className="relative block h-4 w-[18px]" aria-hidden>
              <span
                className={cn(
                  'absolute left-0 block h-px w-full bg-current transition-all duration-300 ease-ant',
                  menuOpen ? 'top-1/2 rotate-45' : 'top-1',
                )}
              />
              <span
                className={cn(
                  'absolute left-0 block h-px w-full bg-current transition-all duration-300 ease-ant',
                  menuOpen ? 'top-1/2 -rotate-45' : 'top-[11px]',
                )}
              />
            </span>
          </button>
        </div>
      </div>

      <div
        className={cn(
          'fixed inset-x-0 bottom-0 top-16 z-30 xl:hidden',
          'border-t border-line bg-bg',
          'transition-[opacity,visibility] duration-300 ease-ant',
          menuOpen ? 'visible opacity-100' : 'invisible opacity-0',
        )}
      >
        <nav aria-label="Mobile" className="ant-container flex flex-col gap-6 overflow-y-auto py-6">
          <div>
            <p className="px-1 pb-2 font-sans text-detail-xs tracking-wide text-ink-faint uppercase">
              {dict.footer.tools}
            </p>
            <ToolSwitch locale={locale} dict={dict} pathname={pathname} compact />
          </div>
          <MobileGroup title={dict.nav.docs} items={docs} />
          <MobileGroup title={dict.nav.guides} items={guides} />
          <a
            href={localePath(locale, '/privacy')}
            className="rounded-main px-3 py-3.5 font-sans text-detail-xl font-medium text-ink transition-colors duration-200 ease-ant hover:bg-surface-hover"
          >
            {dict.nav.privacy}
          </a>

          <div className="border-t border-line pt-5 sm:hidden">
            <p className="px-3 pb-2 font-sans text-detail-xs tracking-wide text-ink-faint uppercase">
              {dict.nav.language}
            </p>
            <LanguageSwitcher locale={locale} label={dict.nav.language} />
          </div>
        </nav>
      </div>
    </header>
  )
}

function MobileGroup({ title, items }: { title: string; items: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="px-1 pb-2 font-sans text-detail-xs tracking-wide text-ink-faint uppercase">
        {title}
      </p>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-main px-3 py-3 font-sans text-detail-l font-medium text-ink transition-colors duration-200 ease-ant hover:bg-surface-hover"
          >
            {item.label}
          </a>
        ))}
      </div>
    </div>
  )
}
