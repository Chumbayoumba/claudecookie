'use client'

import { useEffect } from 'react'
import { trackPageview } from '@/lib/analytics'

/**
 * Fires a single pageview beacon on mount. Rendered once in the locale layout.
 * Navigation is full page loads (see the CSP note in Header), so a mount-only
 * effect captures every page view without a router listener.
 */
export function Analytics({ locale }: { locale: string }) {
  useEffect(() => {
    trackPageview(window.location.pathname, locale)
  }, [locale])
  return null
}
