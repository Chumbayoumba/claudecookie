'use client'

import { useEffect, useRef } from 'react'
import {
  TURNSTILE_ACTION,
  TURNSTILE_SITE_KEY,
  loadTurnstile,
} from '@/lib/turnstile'

interface TurnstileBoxProps {
  onToken: (token: string) => void
  onError: () => void
}

export function TurnstileBox({ onToken, onError }: TurnstileBoxProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const tokenRef = useRef(onToken)
  const errorRef = useRef(onError)
  tokenRef.current = onToken
  errorRef.current = onError

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let widgetId: string | null = null
    let gone = false

    void loadTurnstile()
      .then((api) => {
        if (gone || !hostRef.current) return
        widgetId = api.render(hostRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: TURNSTILE_ACTION,
          theme: 'auto',
          callback: (token) => tokenRef.current(token),
          'error-callback': () => errorRef.current(),
          'expired-callback': () => errorRef.current(),
          retry: 'never',
          'refresh-expired': 'never',
        })
      })
      .catch(() => {
        if (!gone) errorRef.current()
      })

    return () => {
      gone = true
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId)
        } catch {
          // widget already gone
        }
      }
    }
  }, [])

  return <div ref={hostRef} className="min-h-[65px]" />
}
