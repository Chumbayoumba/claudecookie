# A no-key JSON API for Claude cookie tools (dev.to post — DRAFT)

**Tags:** claude, claude-code, javascript, api, devtools
**Title options:**
1. "How I gave Claude cookie tools a public no-key JSON API"
2. "From a pasted cookie to a working ~/.claude/.credentials.json — and a no-key API on top"

---

If you use Claude Code, you have probably hit this wall: the browser stores your login as a `sessionKey` cookie, but Claude Code wants `~/.claude/.credentials.json`. Two different files, same login.

I built [claudecookie.com](https://claudecookie.com) to bridge the gap. Three tools, one place:

- **Converter** — turn Netscape `cookies.txt`, Cookie-Editor JSON, Puppeteer format, key-value or a raw `Cookie` header into each other. Runs entirely in your browser; the paste never leaves your device.
- **Check** — paste a session cookie and it tells you if the session is alive, which plan it belongs to, and how much of the 5-hour and weekly usage windows is left.
- **Credentials** — same check, then download the `~/.claude/.credentials.json` Claude Code actually reads.

## The public API

Every one of those three exists as a public JSON API. No API key, CORS is `*`, everything over HTTPS:

```bash
# convert
curl https://claudecookie.com/api/v1/convert \
  -H "Content-Type: application/json" \
  -d '{"input":"sessionKey=sk-ant-sid01-...","target":"cookie-editor"}'

# check
curl https://claudecookie.com/api/v1/check \
  -H "Content-Type: application/json" \
  -d '{"cookie":"sessionKey=sk-ant-sid01-..."}'

# credentials
curl https://claudecookie.com/api/v1/credential \
  -H "Content-Type: application/json" \
  -d '{"cookie":"sessionKey=sk-ant-sid01-..."}'
```

Batch check accepts up to 10 cookies in one request (`{"cookies": ["...", "..."]}`).

## Rate limits (published, no surprises)

| Route | Budget |
| --- | --- |
| All `/api/v1/*` | 10 req/s per IP (burst 20) |
| `POST /convert` | 60/min per IP |
| `POST /check` | 20/min per IP |
| `POST /credential` | 5/min and 20/hour per IP; 3/hour per sessionKey |

A `429` response carries a `Retry-After` header in seconds.

## Machine-readable docs

- OpenAPI 3.1 spec: <https://claudecookie.com/openapi.json>
- Short agent-facing summary: <https://claudecookie.com/llms.txt>
- Copy-paste scripts: <https://github.com/Chumbayoumba/claudecookie> (`examples/curl.sh`, `examples/check.py`, `examples/convert.mjs`)

## What a check reads

- account email and plan (Free / Pro / Max)
- 5-hour usage window and reset time
- weekly usage window and reset time

It does not log you out, and it does not rotate your cookie on purpose. Treat a live session cookie like a password — only paste a session you control.

The site also has Russian and Chinese versions. Not made by or endorsed by Anthropic.
