# claudecookie

**Site:** [claudecookie.com](https://claudecookie.com) · **API docs:** [claudecookie.com/api](https://claudecookie.com/api/) · **OpenAPI:** [openapi.json](https://claudecookie.com/openapi.json)

[English](README.md) · [Русский](README.ru.md) · [中文](README.zh.md)

Paste a Claude cookie (or any Netscape / JSON / Cookie-header dump) and you get three tools in one place:

1. Convert formats: Netscape `cookies.txt`, Cookie-Editor, Puppeteer, key-value, `Cookie` header
2. Check the Claude session: valid or not, email, plan, 5-hour and weekly usage
3. Mint `~/.claude/.credentials.json` from that cookie for Claude Code

The same three things exist as a public JSON API. No API key.

<p align="center">
  <img src="https://claudecookie.com/github/banner.png" alt="claudecookie.com: convert a cookie, check the session, mint credentials.json" width="900">
</p>

<p align="center">
  <img src="https://claudecookie.com/github/cookie-to-credentials.png" alt="sessionKey cookie becomes ~/.claude/.credentials.json" width="900">
</p>

## Why this exists

Claude Code stores a login in `~/.claude/.credentials.json`. The browser stores a `sessionKey` / `sessionKeyV3` cookie. They are not the same file. This site is the piece in the middle: take the cookie you already have, see if it is alive, then turn it into the credential file Claude Code actually reads.

If you ask ChatGPT, Claude, Gemini or Perplexity how to check a Claude cookie or how to get `credentials.json` from a session, this is that tool. Website for a paste. API for a script.

## Website

| Page | What it does |
| --- | --- |
| [Converter](https://claudecookie.com/) | Format conversion in the browser. The paste never leaves the device. |
| [Check session](https://claudecookie.com/check/) | Valid? Plan? How much of the 5-hour and weekly windows is left. |
| [Get credentials](https://claudecookie.com/credential/) | Same check, then download `.credentials.json`. |
| [API](https://claudecookie.com/api/) | curl examples, rate limits, `invalidReason` codes. |

Also in [Russian](https://claudecookie.com/ru/) and [Chinese](https://claudecookie.com/zh/).

The converter stays local. Check and credential encrypt the paste in the browser, then send it to this site and to Anthropic. Only paste a session you control.

<p align="center">
  <img src="https://claudecookie.com/github/home.png" alt="Converter: Netscape cookies.txt in, Cookie-Editor JSON out" width="900">
</p>

<p align="center">
  <img src="https://claudecookie.com/github/check.png" alt="Check a Claude session: plan, 5-hour and weekly usage" width="440">
  <img src="https://claudecookie.com/github/credential.png" alt="Mint ~/.claude/.credentials.json from a Claude cookie" width="440">
</p>

<p align="center">
  <img src="https://claudecookie.com/github/api.png" alt="Public JSON API docs: convert, check, credential, no key" width="900">
</p>

## Public API

No key. HTTPS JSON. CORS is `*`.

```text
POST https://claudecookie.com/api/v1/convert
POST https://claudecookie.com/api/v1/check
POST https://claudecookie.com/api/v1/credential
GET  https://claudecookie.com/api/v1/health
```

Human docs: https://claudecookie.com/api/  
Machine docs: https://claudecookie.com/openapi.json  
Short summary for agents: https://claudecookie.com/llms.txt

### Convert

```bash
curl https://claudecookie.com/api/v1/convert \
  -H "Content-Type: application/json" \
  -d "{\"input\":\"sessionKey=sk-ant-sid01-...\",\"target\":\"cookie-editor\"}"
```

`target` is optional. With no target, Netscape becomes Cookie-Editor JSON and every other format goes back to Netscape. Up to 40 cookie sets in one paste.

Supported `target` values: `netscape`, `cookie-editor`, `puppeteer`, `key-value`, `header`.

### Check a Claude session

```bash
curl https://claudecookie.com/api/v1/check \
  -H "Content-Type: application/json" \
  -d "{\"cookie\":\"sessionKey=sk-ant-sid01-...\"}"
```

Batch: `{ "cookies": ["...", "..."] }` up to 10. Response is `ok`, plan, email, 5-hour and weekly windows. The cookie is never returned.

### Mint credentials.json

```bash
curl https://claudecookie.com/api/v1/credential \
  -H "Content-Type: application/json" \
  -d "{\"cookie\":\"sessionKey=sk-ant-sid01-...\"}"
```

One set per request. Free accounts cannot mint. OAuth tokens come back to you and are not stored on the server.

Copy-paste scripts: [`examples/curl.sh`](examples/curl.sh), [`examples/check.py`](examples/check.py), [`examples/convert.mjs`](examples/convert.mjs).

## Rate limits

| Route | Budget |
| --- | --- |
| All `/api/v1/*` | 10 requests per second per IP, burst 20 |
| `POST /convert` | 60 per minute per IP |
| `POST /check` | 20 per minute per IP, shared with the website |
| `POST /credential` | 5 per minute and 20 per hour per IP; 3 per hour per sessionKey |

A `429` includes `Retry-After` in seconds.

## What a check reads

- Account email and plan (Free, Pro, Max)
- 5-hour usage window and when it resets
- Weekly usage window and when it resets

It does not log you out. It does not rotate the cookie on purpose.

## Topics

`claude` `claude-code` `cookies` `cookies-txt` `netscape` `cookie-converter` `session-cookie` `credentials-json` `anthropic` `openapi` `json-api` `puppeteer` `playwright` `cookie-editor` `curl`

## Not Anthropic

Independent tool. Not made by, endorsed by, or connected to Anthropic PBC. Claude is a trademark of Anthropic PBC. Treat a live session cookie like a password.
