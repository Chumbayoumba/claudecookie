import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { fontVariables } from '../fonts'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { LocaleHint } from '@/components/layout/LocaleHint'
import { Analytics } from '@/components/Analytics'
import { ThemeScript } from '@/components/layout/ThemeScript'
import { YandexMetrika, YandexMetrikaNoScript } from '@/components/analytics/YandexMetrika'
import { getDictionary } from '@/lib/i18n'
import { LOCALES, LOCALE_META, SITE_URL, isLocale, type Locale } from '@/lib/i18n/config'
import '../globals.css'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // template is '%s' (no brand suffix): the old '%s | claudecookie' pushed 9 of
  // 18 sub-page titles past Google's ~60-char cut, and the truncated tail was
  // always the brand token - pixels spent for nothing. Each page owns its full
  // title; the brand lives in the home `default` and in the domain itself.
  title: { default: 'claudecookie — Cookie Converter & Claude cookie checker', template: '%s' },
  applicationName: 'claudecookie',
  robots: { index: true, follow: true },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f5' },
    { media: '(prefers-color-scheme: dark)', color: '#141413' },
  ],
}

interface LayoutProps {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export default async function LocaleLayout({ children, params }: LayoutProps) {
  const { locale: raw } = await params
  if (!isLocale(raw)) notFound()

  const locale = raw as Locale
  const dict = getDictionary(locale)

  return (
    // The next/font variables go on <html>, not <body>: globals.css resolves
    // them at :root, and a custom property declared only on <body> would make
    // every --font-* reference invalid there.
    <html
      lang={LOCALE_META[locale].tag}
      dir={LOCALE_META[locale].dir}
      className={fontVariables}
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
        <YandexMetrika />
      </head>
      <body className="ant-noise min-h-dvh antialiased">
        <YandexMetrikaNoScript />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-main focus:bg-invert focus:px-4 focus:py-2 focus:font-sans focus:text-detail-s focus:text-invert-ink"
        >
          {dict.common.skipToContent}
        </a>
        <Header locale={locale} dict={dict} />
        <main id="main" className="relative z-10">
          {children}
        </main>
        <Footer locale={locale} dict={dict} />
        <LocaleHint locale={locale} />
        <Analytics locale={locale} />
      </body>
    </html>
  )
}
