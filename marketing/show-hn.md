# Show HN draft (DRAFT — do not publish yet)

**Title:** Show HN: claudecookie – convert, check, and mint Claude Code credentials from a cookie

**Body:**

I use Claude Code daily, and the browser login (a `sessionKey` cookie) and the file Claude Code actually reads (`~/.claude/.credentials.json`) are two different things. claudecookie.com bridges that gap:

- Converter: Netscape cookies.txt <-> Cookie-Editor, Puppeteer, key-value, raw `Cookie` header. Runs in the browser; the paste stays on your device.
- Check: is the session alive? plan, 5-hour and weekly usage windows, reset times.
- Credentials: same check, then a downloadable `.credentials.json`.

All three are also a public JSON API — no API key, CORS `*`, published rate limits, OpenAPI 3.1 spec and an agent-facing `llms.txt`:

- Site: https://claudecookie.com (English / Russian / Chinese)
- API docs: https://claudecookie.com/api/
- OpenAPI: https://claudecookie.com/openapi.json
- GitHub (examples + spec): https://github.com/Chumbayoumba/claudecookie

Comments? What would make this more useful?
