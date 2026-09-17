import { Logo, Wordmark } from './Logo'
import { localePath, type Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

interface FooterProps {
  locale: Locale
  dict: Dictionary
}

export function Footer({ locale, dict }: FooterProps) {
  const year = new Date().getFullYear()

  const columns = [
    {
      title: dict.footer.tools,
      links: [
        { href: localePath(locale, '/'), label: dict.footer.converter },
        { href: localePath(locale, '/check'), label: dict.footer.checker },
        { href: localePath(locale, '/credential'), label: dict.footer.credentials },
      ],
    },
    {
      title: dict.footer.guides,
      links: [
        { href: localePath(locale, '/claude-code-login'), label: dict.nav.claudeCodeLogin },
        { href: localePath(locale, '/claude-usage-limits'), label: dict.nav.claudeUsage },
      ],
    },
    {
      title: dict.footer.docs,
      links: [
        {
          href: localePath(locale, '/formats/netscape-cookies-txt'),
          label: dict.nav.netscapeFormat,
        },
        { href: localePath(locale, '/formats/json-cookies'), label: dict.nav.jsonFormat },
        { href: localePath(locale, '/privacy'), label: dict.nav.privacy },
      ],
    },
  ]

  return (
    <footer className="relative z-10 mt-24 border-t border-line bg-bg-secondary">
      <div className="ant-container py-14">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 text-ink">
              <Logo className="text-clay" />
              <Wordmark />
            </div>
            <p className="mt-4 text-paragraph-xs text-ink-secondary">{dict.footer.tagline}</p>
          </div>

          <div className="grid grid-cols-3 gap-10 lg:gap-16">
            {columns.map((col) => (
              // <nav> gives the group an accessible name without spending a
              // heading: the three footer column labels used to emit identical
              // boilerplate <h2>s on all 18 pages, diluting the heading outline
              // that search engines and LLM extractors build the topic map from.
              <nav key={col.title} aria-label={col.title}>
                <p className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
                  {col.title}
                </p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className="ant-link font-sans text-detail-s text-ink-secondary hover:text-ink"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-line pt-8 font-sans text-detail-xs text-ink-faint sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-xl leading-relaxed">{dict.footer.disclaimer}</p>
          <div className="flex shrink-0 flex-col gap-1 sm:items-end">
            <p>
              &copy; {year} claudecookie.com. {dict.footer.rights}
            </p>
            <p>
              <a
                href="https://db-ip.com"
                rel="noopener noreferrer external"
                target="_blank"
                className="ant-link hover:text-ink-secondary"
              >
                {dict.footer.geoAttribution}
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
