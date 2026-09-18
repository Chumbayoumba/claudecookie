/**
 * Public Turnstile sitekey and explicit-render loader.
 * The widget secret stays on the origin and is never imported here.
 */

export const TURNSTILE_SITE_KEY = '0x4AAAAAAE6gDTNt891GoIWv'
export const TURNSTILE_ACTION = 'credential'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export interface TurnstileApi {
  render: (
    container: string | HTMLElement,
    options: {
      sitekey: string
      action?: string
      theme?: 'auto' | 'light' | 'dark'
      callback?: (token: string) => void
      'error-callback'?: () => void
      'expired-callback'?: () => void
      retry?: 'auto' | 'never'
      'refresh-expired'?: 'auto' | 'manual' | 'never'
    },
  ) => string
  reset: (widgetId?: string) => void
  remove: (widgetId: string) => void
  getResponse: (widgetId?: string) => string
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | null = null

export function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('turnstile'))
  }
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    const script = existing ?? document.createElement('script')
    const done = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('turnstile'))
    }
    script.addEventListener('load', done)
    script.addEventListener('error', () => reject(new Error('turnstile')))
    if (!existing) {
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    } else if (window.turnstile) {
      resolve(window.turnstile)
    }
  })
  return loading
}
