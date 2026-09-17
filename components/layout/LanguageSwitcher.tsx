'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_META,
  isLocale,
  localePath,
  type Locale,
} from '@/lib/i18n/config'
import { cn } from '@/lib/utils/cn'

interface LanguageSwitcherProps {
  locale: Locale
  label: string
}

/**
 * Removes a leading locale segment (`/ru`, `/zh`, or `/en`) so the path can be
 * re-prefixed for another locale.
 *
 * `en` must be stripped too: at build time `usePathname()` returns the internal
 * route `/en/check` for the English pages (even though nginx serves them at
 * `/check/`), so leaving `en` in place produced doubled hrefs like `/ru/en/`.
 * At runtime the English URLs carry no `/en` prefix, so stripping it is a no-op
 * there - the branch only fires on the build-time internal path.
 */
export function stripLocale(pathname: string): string {
  const [, first, ...rest] = pathname.split('/')
  if (first && isLocale(first)) {
    return `/${rest.join('/')}`
  }
  return pathname
}

/**
 * Language menu.
 *
 * Choosing a language writes the `cclang` cookie, which the nginx geo redirect
 * checks for - so a manual choice permanently overrides IP-based detection.
 */
export function LanguageSwitcher({ locale, label }: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // Pin the manual choice before the anchor navigates. The nginx geo redirect
  // reads this cookie, so a manual pick permanently overrides IP detection.
  function pin(next: Locale) {
    setOpen(false)
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`
    // The plain <a> handles the actual navigation (full page load, matching the
    // rest of the site's no-next/link policy) - no preventDefault here.
  }

  const target = stripLocale(pathname)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 cursor-pointer items-center gap-1.5 rounded-main px-2.5',
          'font-sans text-detail-s font-medium text-ink-secondary',
          'transition-colors duration-200 ease-ant hover:bg-surface-hover hover:text-ink',
        )}
      >
        <svg viewBox="0 0 24 24" className="size-[17px]" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        <span>{LOCALE_META[locale].name}</span>
      </button>

      {/* Rendered unconditionally (hidden until open) as real <a> anchors so the
          static HTML carries a crawlable, hreflang-annotated link to every other
          locale - the only cross-locale link equity the site has. */}
      <div
        role="menu"
        hidden={!open}
        className={cn(
          'absolute right-0 top-[calc(100%+0.5rem)] z-50 min-w-[9.5rem]',
          'overflow-hidden rounded-main border border-line bg-surface',
          'shadow-[0_8px_32px_-8px_rgba(20,20,19,0.18)]',
        )}
      >
        {LOCALES.map((l) => (
          <a
            key={l}
            role="menuitem"
            lang={LOCALE_META[l].tag}
            hrefLang={LOCALE_META[l].tag}
            href={localePath(l, target)}
            onClick={() => pin(l)}
            className={cn(
              'flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2',
              'font-sans text-detail-s no-underline transition-colors duration-150 ease-ant',
              'hover:bg-surface-hover',
              l === locale ? 'text-clay font-medium' : 'text-ink',
            )}
            aria-current={l === locale ? 'true' : undefined}
          >
            {LOCALE_META[l].name}
            {l === locale && (
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
                <path
                  d="m3 8.5 3.2 3.2L13 5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </a>
        ))}
      </div>
    </div>
  )
}
