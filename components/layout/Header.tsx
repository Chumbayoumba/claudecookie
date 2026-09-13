'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LanguageSwitcher } from './LanguageSwitcher'
import { Logo, Wordmark } from './Logo'
import { ThemeToggle } from './ThemeToggle'
import { localePath, type Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { cn } from '@/lib/utils/cn'

/*
 * Navigation uses plain anchors, not next/link.
 *
 * The site ships `connect-src 'self'`. Same-origin beacons and the session
 * check are allowed; third-party fetches are not. Next's client-side router
 * still works by fetching an RSC payload, so navigation uses plain anchors.
 *
 * Across the static pages whose shared JS is already cached, a browser
 * navigation costs nothing measurable. Keeping the directive airtight is worth
 * more than soft navigation here.
 */

interface HeaderProps {
  locale: Locale
  dict: Dictionary
}

export function Header({ locale, dict }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  // The header only grows a border once the page has moved, so it sits flush
  // against the hero at rest.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile panel whenever navigation actually happens.
  useEffect(() => setMenuOpen(false), [pathname])

  // A fixed-position panel over the page must not leave the body scrollable.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const links = [
    { href: localePath(locale, '/check'), label: dict.nav.check },
    { href: localePath(locale, '/formats/netscape-cookies-txt'), label: dict.nav.netscapeFormat },
    { href: localePath(locale, '/formats/json-cookies'), label: dict.nav.jsonFormat },
    { href: localePath(locale, '/privacy'), label: dict.nav.privacy },
  ]

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,border-color] duration-300 ease-ant',
        'border-b bg-bg/80 backdrop-blur-md',
        scrolled ? 'border-line' : 'border-transparent',
      )}
    >
      <div className="ant-container flex h-16 items-center justify-between gap-4">
        <a
          href={localePath(locale, '/')}
          className="flex items-center gap-2.5 text-ink transition-opacity duration-200 ease-ant hover:opacity-70"
        >
          <Logo className="text-clay" />
          <Wordmark />
        </a>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {links.map((link) => {
            const active = pathname === link.href
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-main px-3 py-2 font-sans text-detail-s font-medium',
                  'transition-colors duration-200 ease-ant hover:bg-surface-hover',
                  active ? 'text-ink' : 'text-ink-secondary hover:text-ink',
                )}
              >
                {link.label}
              </a>
            )
          })}
        </nav>

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
              'grid size-9 cursor-pointer place-items-center rounded-main lg:hidden',
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

      {/* Mobile panel. Rendered below the 16px header bar, covering the rest. */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 top-16 z-30 lg:hidden',
          'border-t border-line bg-bg',
          'transition-[opacity,visibility] duration-300 ease-ant',
          menuOpen ? 'visible opacity-100' : 'invisible opacity-0',
        )}
      >
        <nav aria-label="Mobile" className="ant-container flex flex-col gap-1 py-6">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-main px-3 py-3.5 font-sans text-detail-xl font-medium text-ink transition-colors duration-200 ease-ant hover:bg-surface-hover"
            >
              {link.label}
            </a>
          ))}

          <div className="mt-4 border-t border-line pt-5 sm:hidden">
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
