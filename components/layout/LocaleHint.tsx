'use client'

import { AnimatePresence, motion } from 'motion/react'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { stripLocale } from './LanguageSwitcher'
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_META,
  localePath,
  matchLocale,
  type Locale,
} from '@/lib/i18n/config'

/*
 * Only the hint strings are duplicated here rather than importing the three full
 * dictionaries, which would pull every translation into the client bundle for
 * the sake of one sentence. The message must be written in the language being
 * offered, otherwise it is useless to the person who needs it.
 */
const HINTS: Record<Locale, { message: string; accept: string; dismiss: string }> = {
  en: { message: 'This page is available in English.', accept: 'Switch', dismiss: 'Stay here' },
  ru: { message: 'Эта страница доступна на русском.', accept: 'Переключить', dismiss: 'Остаться' },
  zh: { message: '本页面提供中文版本。', accept: '切换', dismiss: '留在此页' },
}

const DISMISSED_KEY = 'cclang-hint-dismissed'

/**
 * Offers a language switch when the browser language does not match the page.
 *
 * This is the client-side complement to the nginx geo redirect: geolocation
 * catches where you are, this catches what your browser is actually set to. It
 * never appears once `cclang` is set, because that means a choice was made.
 */
export function LocaleHint({ locale }: { locale: Locale }) {
  const [suggested, setSuggested] = useState<Locale | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    try {
      if (document.cookie.includes(`${LOCALE_COOKIE}=`)) return
      if (sessionStorage.getItem(DISMISSED_KEY)) return
    } catch {
      return
    }

    const preferred = matchLocale(navigator.languages ?? [navigator.language])
    if (preferred && preferred !== locale) setSuggested(preferred)
  }, [locale])

  function remember(choice: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${choice}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`
  }

  function accept() {
    if (!suggested) return
    remember(suggested)
    setSuggested(null)
    window.location.assign(localePath(suggested, stripLocale(pathname)))
  }

  function dismiss() {
    // Session-scoped, not the year-long cookie: declining once should not lock
    // the choice in forever.
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1')
    } catch {
      // Storage unavailable; the hint simply reappears next navigation.
    }
    setSuggested(null)
  }

  const hint = suggested ? HINTS[suggested] : null

  return (
    <AnimatePresence>
      {suggested && hint && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.35, ease: [0.165, 0.84, 0.44, 1] }}
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md sm:inset-x-auto sm:right-6 sm:bottom-6"
          lang={LOCALE_META[suggested].tag}
        >
          <div className="flex flex-col gap-3 rounded-large border border-line bg-surface p-4 shadow-[0_12px_40px_-12px_rgba(20,20,19,0.28)] sm:flex-row sm:items-center">
            <p className="font-sans text-detail-s text-ink">{hint.message}</p>
            <div className="flex shrink-0 gap-2 sm:ms-auto">
              <button
                type="button"
                onClick={accept}
                className="h-8 cursor-pointer rounded-small bg-invert px-3 font-sans text-detail-xs font-medium text-invert-ink transition-colors duration-200 ease-ant hover:bg-invert-hover"
              >
                {hint.accept}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="h-8 cursor-pointer rounded-small px-3 font-sans text-detail-xs font-medium text-ink-secondary transition-colors duration-200 ease-ant hover:bg-surface-hover hover:text-ink"
              >
                {hint.dismiss}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
