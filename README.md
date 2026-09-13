# claudecookie.com

A cookie format converter: Netscape `cookies.txt` to JSON and back, in five
formats, with the input format detected automatically. Conversion runs in the
browser — that paste is not uploaded.

A separate **Check cookie** page (`/check`, `/ru/check`, `/zh/check`) is
different. The browser seals the paste and posts it to this site’s own backend,
which calls `claude.ai` for the account, plan and usage windows.

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
components/         converter/, check/, layout/, ui/, seo/
app/[locale]/       Five routes per locale, statically generated
server/             ingest on :8787 (`/e`, `/check`, `/box`) and the Telegram bot
deploy/             nginx config, server setup, release script
tests/              conversion core, i18n consistency, Python session-check mocks
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

# Session check (optional locally). Next rewrites POST /check and /e to :8787.
# Point the SQLite file at a writable path; without TG_* the JSON still returns.
$env:CC_STATS_DB = "$env:TEMP\claudecookie-stats.db"
python server/stats_service.py
# then open http://localhost:3000/en/check/
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
./deploy/deploy-stats.sh   # ingest + Telegram bot, including POST /check
# install deploy/nginx.conf as root if the site file on the server is older
# (the deploy user may only nginx -t and reload)
./deploy/deploy.sh
```

It runs the tests, builds, rsyncs to a timestamped release directory and flips
the `current` symlink atomically. The last five releases are kept, so a rollback
is one symlink:

```bash
ssh deploy@<host> 'ln -sfnT /var/www/claudecookie/releases/<older> /var/www/claudecookie/current'
```

## Privacy

The converter and the session check have different trust models. Conversion is
still JavaScript in the browser. The check page has to leave the device: the
browser encrypts the paste and posts to same-origin `POST /check` (no trailing
slash — that path is the API; `/check/` is the static page). The Python ingest
service opens the box and calls `claude.ai`.

The check is built to not burn the cookie it inspects. It makes at most two
`GET`s (`/api/bootstrap`, then usage only if the windows are missing), stops on
the first `401/403`, follows no redirects, and only ever sends a browser TLS
fingerprint via `curl_cffi` — if that library is missing it refuses to send
rather than fall back to a bot-looking request. Duplicate/parallel checks of the
same session are collapsed into one outbound call. The largest remaining risk is
the egress IP: a valid cookie coming from the datacenter IP looks like theft, so
route checks through a **sticky residential proxy** (`CC_CHECK_PROXY` /
`_POOL` / `_TEMPLATE`, matched to the visitor's country) and, once one is wired
in, set `CC_REQUIRE_PROXY=1` so the service never checks from the bare server IP.
If Claude rotates the session during a check, the fresh cookie from `Set-Cookie`
is captured so the copy delivered to Telegram stays live. See `.env.example` and
`server/diag_rotation.py` (a throwaway-session probe for whether an endpoint
rotates) for details.

The site sends a Content-Security-Policy with `connect-src 'self'`. Same-origin
beacons and the session check are allowed; third-party fetches are not. There is
no third-party script. The only cookie the site itself sets is `cclang`.

One consequence: Next’s client-side router fetches an RSC payload. Navigation
uses plain `<a>` elements and full page loads so that behaviour stays obvious.
`next/link` must not be reintroduced — it would log a CSP noise on every page
and silently fall back to a hard navigation anyway.

## Not affiliated with Anthropic

This is an independent tool. It is not made by, endorsed by, or connected to
Anthropic PBC. Claude is a trademark of Anthropic PBC.
