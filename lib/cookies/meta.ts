import type { CookieFormat } from './types'

interface FormatMeta {
  /** Short label for tabs and badges. */
  label: string
  /** Filename used by the download button. */
  filename: string
  mime: string
  /** Tells the output panel whether to apply JSON token highlighting. */
  syntax: 'json' | 'text'
}

export const FORMAT_META: Record<CookieFormat, FormatMeta> = {
  netscape: {
    label: 'Netscape',
    filename: 'cookies.txt',
    mime: 'text/plain;charset=utf-8',
    syntax: 'text',
  },
  'cookie-editor': {
    label: 'Cookie-Editor',
    filename: 'cookies.json',
    mime: 'application/json;charset=utf-8',
    syntax: 'json',
  },
  puppeteer: {
    label: 'Puppeteer',
    filename: 'cookies.json',
    mime: 'application/json;charset=utf-8',
    syntax: 'json',
  },
  'key-value': {
    label: 'Key-Value',
    filename: 'cookies.json',
    mime: 'application/json;charset=utf-8',
    syntax: 'json',
  },
  header: {
    label: 'Header',
    filename: 'cookie-header.txt',
    mime: 'text/plain;charset=utf-8',
    syntax: 'text',
  },
}

/** Formats that carry no domain/path/expiry and therefore lose data on export. */
export const LOSSY_FORMATS: readonly CookieFormat[] = ['key-value', 'header'] as const

export function isLossy(format: CookieFormat): boolean {
  return LOSSY_FORMATS.includes(format)
}
