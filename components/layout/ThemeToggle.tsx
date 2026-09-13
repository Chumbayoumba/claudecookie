'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils/cn'

type Theme = 'light' | 'dark'

interface ThemeToggleProps {
  labels: { theme: string; light: string; dark: string }
}

/**
 * Light/dark switch.
 *
 * The theme itself is applied by the inline script in the document head before
 * first paint; this component only reads what that script decided and flips it,
 * so there is never a flash of the wrong theme.
 */
export function ThemeToggle({ labels }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme')
    setTheme(current === 'dark' ? 'dark' : 'light')
    setMounted(true)
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('cctheme', next)
    } catch {
      // Private mode or blocked storage: the choice just will not persist.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`${labels.theme}: ${theme === 'dark' ? labels.dark : labels.light}`}
      className={cn(
        'grid size-9 cursor-pointer place-items-center rounded-main',
        'text-ink-secondary transition-colors duration-200 ease-ant',
        'hover:bg-surface-hover hover:text-ink',
      )}
    >
      {/* Until mounted we do not know the theme, so render a stable neutral icon
          to avoid a hydration mismatch between server HTML and the client. */}
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" aria-hidden>
        {mounted && theme === 'dark' ? (
          <>
            <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </>
        ) : (
          <path
            d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  )
}
