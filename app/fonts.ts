import { Inter, JetBrains_Mono, Source_Serif_4 } from 'next/font/google'

/*
 * Anthropic Sans / Serif / Mono are proprietary and self-hosted on their CDN,
 * so we use the closest free equivalents. `next/font` downloads and serves them
 * from our own origin at build time, which keeps `font-src 'self'` intact and
 * means no request ever goes to Google at runtime.
 *
 * `preload: false` on all three is deliberate. The layout is shared by all
 * locales, so preloading would emit a <link rel="preload"> for every subset of
 * every font - nine files - on every page, of which any given page uses three.
 * Without those links the browser reads the `unicode-range` on each @font-face
 * and fetches only the subsets whose glyphs actually appear. The usual cost of
 * that - a flash of fallback text - is covered by next/font's metric-matched
 * fallback faces, so nothing shifts when the real font arrives.
 */

/** Stand-in for Anthropic Sans: UI chrome, buttons, labels. */
export const fontSans = Inter({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
  preload: false,
})

/** Stand-in for Anthropic Serif: headings and body copy. */
export const fontSerif = Source_Serif_4({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-serif-display',
  display: 'swap',
  preload: false,
})

/** anthropic.com itself uses JetBrains Mono, so this one is an exact match. */
export const fontMono = JetBrains_Mono({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-jetbrains',
  display: 'swap',
  preload: false,
})

export const fontVariables = `${fontSans.variable} ${fontSerif.variable} ${fontMono.variable}`
