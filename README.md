# claudecookie.com

A cookie format converter: Netscape `cookies.txt` to JSON and back, in five
formats, with the input format detected automatically. Everything runs in the
browser — nothing is uploaded.

Available in English (`/`), Russian (`/ru/`) and Simplified Chinese (`/zh/`).

## Stack

- **Next.js 15** (App Router) with `output: 'export'` — the build is a folder of
  static files, served directly by nginx. No Node process runs on the server.
- **TypeScript** throughout, **Tailwind CSS v4** for styling
- **Motion** for animation
- **Vitest** for the conversion core

## Layout

```
lib/cookies/        The conversion core. Pure TypeScript, no React.
  detect.ts           Which format is this?
  parse/              netscape.ts, json.ts, header.ts
  serialize/          netscape.ts, cookieEditor.ts, puppeteer.ts, keyValue.ts, header.ts
  index.ts            convert() — the single entry point
lib/i18n/           Typed dictionaries. en.ts is the source of truth; the
                    Dictionary type is derived from it, so a missing key in
                    ru.ts or zh.ts fails `tsc`.
components/         converter/, layout/, ui/, seo/
app/[locale]/       Four routes per locale, statically generated
deploy/             nginx config, server setup, release script
tests/              82 tests: the conversion core, plus i18n consistency
```

The core is deliberately framework-free and sits behind one function:

```ts
convert(input, { target?, source?, defaultDomain?, now? })
  -> { ok, detected, target, output, cookies, issues, stats }
```

Parsers emit translation keys (`issue.netscape.spacesNotTabs`) rather than
prose, so the same parser output renders in whichever language is being read.

## Supported formats

| Format | Detected by | Stores domain / expiry / flags |
|---|---|---|
| Netscape `cookies.txt` | header comment or tab layout | yes |
| Cookie-Editor / EditThisCookie | `expirationDate`, `storeId`, `hostOnly` | yes |
| Puppeteer / Playwright | `expires`, `None`/`Lax`/`Strict` | yes |
| Key-value map | flat object of strings | no |
| `Cookie:` header string | `a=1; b=2` | no |

## Development

```bash
pnpm install
pnpm dev          # http://localhost:3000/en
pnpm test         # conversion core
pnpm typecheck
pnpm build        # -> out/
```

Note that `/` only serves English on the real server, where nginx maps it to
`/en/index.html`. In `pnpm dev` use `/en` directly.

## Language detection

Three things decide which language a visitor gets, in order:

1. **The `cclang` cookie.** Set by the language switcher. Always wins.
2. **IP geolocation**, done by nginx with the geoip2 module against an offline
   DB-IP Lite database. Only the bare `/` redirects, and only with a `302`.
   Crawlers are matched by user agent and never redirected, so Google, Yandex
   and Baidu can each reach all three locales and `hreflang` resolves properly.
3. **`navigator.language`**, used only for a dismissible hint offering to switch.

English is canonical at the root and carries `hreflang="x-default"`; `/en/`
permanently redirects to `/`.

## Deployment

Configuration lives in `.env` (gitignored):

```bash
cp .env.example .env
```

First time, on the server as root:

```bash
scp -r deploy root@<host>:/tmp/cc-deploy
ssh root@<host> 'bash /tmp/cc-deploy/setup-server.sh'
```

That installs nginx with geoip2, fetches the geo database and sets up a monthly
cron for it, obtains a Let's Encrypt certificate, configures the firewall, and
creates an unprivileged `deploy` account that may reload nginx and nothing else.

Then, from your machine:

```bash
./deploy/deploy.sh
```

It runs the tests, builds, rsyncs to a timestamped release directory and flips
the `current` symlink atomically. The last five releases are kept, so a rollback
is one symlink:

```bash
ssh deploy@<host> 'ln -sfnT /var/www/claudecookie/releases/<older> /var/www/claudecookie/current'
```

## Privacy

The site sends a Content-Security-Policy with `connect-src 'none'`. The browser
will not let the page make a network request of any kind, which makes "your
cookies never leave your device" checkable in DevTools rather than a claim you
have to take on faith. There is no analytics and no third-party script. The only
cookie set is `cclang`.

If you add analytics later, that directive has to be relaxed — at which point
the claim on `/privacy` stops being true and needs rewording.

One consequence worth knowing about: `connect-src 'none'` also blocks Next's own
client-side router, which navigates by fetching an RSC payload. Rather than
relax the directive, navigation uses plain `<a>` elements and full page loads.
Across four static pages with shared JS already cached that costs nothing
measurable, but it does mean `next/link` must not be reintroduced — it would log
a CSP violation on every page and silently fall back to a hard navigation anyway.

## Not affiliated with Anthropic

This is an independent tool. It is not made by, endorsed by, or connected to
Anthropic PBC. Claude is a trademark of Anthropic PBC.
