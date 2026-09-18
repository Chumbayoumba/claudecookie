import type { PluralForms } from '../plural'

/**
 * Counter labels, declared separately so the type carries every plural form.
 * Deriving `Dictionary` from a bare English literal would type these as
 * `{ one, other }` and leave Russian no place to put `few` and `many`.
 */
type StatKey = 'cookies' | 'domains' | 'expired' | 'session' | 'secure' | 'httpOnly'
export type StatLabels = Record<StatKey, PluralForms>

const statsEn: StatLabels = {
  cookies: { one: 'cookie', other: 'cookies' },
  domains: { one: 'domain', other: 'domains' },
  expired: { other: 'expired' },
  session: { one: 'session', other: 'sessions' },
  secure: { other: 'secure' },
  httpOnly: { other: 'http-only' },
}

/**
 * English is the source of truth: `Dictionary` is derived from this object, so
 * a missing or misspelled key in `ru.ts` / `zh.ts` fails the type check.
 */
export const en = {
  meta: {
    home: {
      title: 'Cookie Converter & Claude cookie checker — cookies.txt to JSON',
      description:
        'Convert cookies between Netscape cookies.txt and JSON — Cookie-Editor, Puppeteer, key-value, header. Format auto-detected. Free, runs entirely in your browser.',
    },
    netscape: {
      title: 'The Netscape cookies.txt format, field by field',
      description:
        'What each of the seven tab-separated fields in a Netscape cookies.txt file means, how the #HttpOnly_ prefix works, and which tools read and write this format.',
    },
    json: {
      title: 'JSON cookie formats: Cookie-Editor, Puppeteer, key-value',
      description:
        'The four JSON shapes cookies are exported in, with live examples and a capability table showing which attributes each shape can and cannot store.',
    },
    privacy: {
      title: 'Privacy — how this site handles cookies you paste',
      description:
        'The converter runs in your browser. The session check sends an encrypted Claude cookie to this site’s backend and to Anthropic.',
    },
    check: {
      title: 'Check a Claude cookie: valid? plan, 5h and weekly usage',
      description:
        'Paste a claude.ai session cookie (sessionKey), Netscape or JSON. See whether it is still valid, the plan, and the 5-hour and weekly usage windows.',
    },
    credential: {
      title: 'Get a credential file — turn a Claude cookie into credentials',
      description:
        'Paste a Claude session cookie in any format and download ~/.claude/.credentials.json for Claude Code.',
    },
    claudeCodeLogin: {
      title: 'Claude Code “session expired / run /login” — how to fix',
      description:
        'Why Claude Code logs you out with “Your session has expired. Please run /login”, the /logout → /login fix, the ANTHROPIC_API_KEY trap, and how to clear ~/.claude/.credentials.json.',
    },
    claudeUsage: {
      title: 'Claude 5-hour limit and weekly usage, when they reset',
      description:
        'How Claude Pro and Max meter the rolling 5-hour limit and the weekly cap, shared across claude.ai, Claude Code and Desktop — why you hit “usage limit reached”, and when it resets.',
    },
    api: {
      title: 'Public API: convert cookies, check Claude, get credentials',
      description:
        'JSON API to convert cookie formats, check a Claude session, and mint credentials.json. Same results as the website, with published rate limits.',
    },
  },

  nav: {
    formats: 'Formats',
    netscapeFormat: 'Netscape cookies.txt',
    jsonFormat: 'JSON formats',
    faq: 'FAQ',
    privacy: 'Privacy',
    check: 'Check cookie',
    converter: 'Cookie converter',
    getCredential: 'Get credential file',
    convertShort: 'Converter',
    checkShort: 'Check',
    credentialsShort: 'Credentials',
    docs: 'Docs',
    api: 'API',
    guides: 'Guides',
    claudeCodeLogin: 'Claude Code login fix',
    claudeUsage: 'Claude usage limits',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    language: 'Language',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
  },

  hero: {
    eyebrow: 'Cookie converter',
    title: 'Convert cookies.',
    subtitle: 'Without sending them anywhere.',
    formats: 'Netscape cookies.txt ↔ JSON ↔ Cookie-Editor ↔ Puppeteer ↔ Cookie header',
    privacy: 'Runs entirely in your browser',
  },

  home: {
    formatsTitle: 'Formats it converts between',
  },

  converter: {
    inputLabel: 'Input',
    outputLabel: 'Output',
    detected: 'detected',
    detectedGuess: 'best guess',
    awaiting: 'Ready',
    unknown: 'Not recognised',
    detecting: 'Detecting…',
    convertTo: 'Convert to',
    convert: 'Paste cookies first',
    converted: 'Converted',
    convertAgain: 'Convert again',
    swap: 'Swap input and output',
    batchSets: 'cookie sets',
    combine: 'Combine into one file',
    separate: 'Separate',
    setWord: 'Set',
    copy: 'Copy',
    copyLine: 'Copy line',
    copied: 'Copied',
    download: 'Download',
    downloadAll: 'Download all',
    resize: 'Resize converter',
    clear: 'Clear',
    sample: 'Sample',
    upload: 'Upload',
    dropHere: 'Drop cookie files',
    dropHint: "We'll detect the format automatically",
    placeholder: 'Paste cookies here',
    emptyHintWin: 'Ctrl+V or drop files',
    emptyHintMac: '⌘V or drop files',
    formatsChip: 'Netscape · JSON · Cookie header',
    chooseFile: 'Choose files',
    staysInBrowser: 'Processed locally in your browser',
    localTooltip: 'Your input never leaves this browser.',
    localBadge: 'Local',
    tryExample: 'Try sample:',
    autoDetects: 'Input format is detected automatically',
    outputReady: 'Ready',
    outputPlaceholder: 'Output appears here',
    outputEmptyHint: 'Paste on the left — the result appears here.',
    outputReadyConvert: 'Ready to convert',
    tabsMore: 'More',
    convertHintWin: 'Ctrl+Enter to convert',
    convertHintMac: '⌘Enter to convert',
    defaultDomain: 'Default domain',
    defaultDomainHint:
      'Key-value maps and Cookie headers carry no domain. Set one here so the exported file is valid.',
    defaultDomainPlaceholder: 'example.com',
    fileTooLarge: 'That file is too large. The limit is 2 MB.',
    readError: 'That file could not be read.',
  },

  stats: statsEn,

  issues: {
    'issue.unknownFormat':
      'This does not look like any format we recognise. Try a Netscape cookies.txt file, a JSON export, a key-value map, or a Cookie header.',
    'issue.tooLarge': 'That input is too large. The limit is 2 MB.',
    'issue.duplicates':
      'Two or more cookies shared a name, domain and path. They were merged, keeping the last one — which is what a browser would do.',
    'issue.missingDomain':
      'Some cookies have no domain. Set a default domain so the Netscape file is actually usable.',
    'issue.lossyTarget':
      'This format stores names and values only. Domain, path, expiry, secure and http-only are dropped.',
    'issue.nameCollision':
      'Two cookies share a name but differ by domain or path. This format can only keep one of them.',
    'issue.netscape.badLine': 'This line could not be read as a cookie.',
    'issue.netscape.missingName': 'This line has no cookie name.',
    'issue.netscape.emptyValue':
      'This line has six fields instead of seven, so the value was read as empty.',
    'issue.netscape.spacesNotTabs':
      'The tabs in this file have been replaced by spaces somewhere along the way. It was parsed anyway — worth checking the values came through intact.',
    'issue.netscape.noCookies': 'No cookie lines were found in this file.',
    'issue.json.invalid': 'This is not valid JSON.',
    'issue.json.unsupportedShape':
      'This JSON parsed, but its shape is not one we recognise as cookies.',
    'issue.json.notAnObject': 'This entry is not an object.',
    'issue.json.missingName': 'This entry has no name, so it was skipped.',
    'issue.json.missingValue': 'This entry has no value, so it was skipped.',
    'issue.json.empty': 'No cookies were found in this JSON.',
    'issue.header.empty': 'No name=value pairs were found.',
    'issue.header.badPair': 'A fragment that was not name=value was skipped.',
  },

  formats: {
    netscape: { label: 'Netscape', hint: 'cookies.txt — curl, wget, yt-dlp' },
    'cookie-editor': { label: 'Cookie-Editor', hint: 'Chrome and Firefox extensions' },
    puppeteer: { label: 'Puppeteer', hint: 'Puppeteer and Playwright' },
    'key-value': { label: 'Key-Value', hint: 'requests, axios' },
    header: { label: 'Header', hint: 'Cookie: request header' },
  },

  how: {
    title: 'How it works',
    steps: [
      {
        title: 'Paste, drop, or upload',
        body: 'Drop a cookies.txt file onto the panel, paste a JSON export, or paste a raw Cookie header. The file is read by your browser and goes no further.',
      },
      {
        title: 'The format is worked out',
        body: 'A Netscape file is recognised by its tab layout, Cookie-Editor by its expirationDate and storeId fields, Puppeteer by its expires field. The opposite format is selected for the output.',
      },
      {
        title: 'Copy or download',
        body: 'Take the result to the clipboard, or download it as cookies.txt or cookies.json. Use the swap button to run the conversion the other way.',
      },
    ],
  },

  faq: {
    title: 'Questions',
    items: [
      {
        q: 'What is the Netscape cookie format?',
        a: 'A plain text file with one cookie per line and seven tab-separated fields: domain, include-subdomains flag, path, secure flag, expiry, name and value. It was introduced by Netscape Navigator and is still what curl, wget and yt-dlp read and write today.',
      },
      {
        q: 'Is anything I paste sent to a server?',
        a: 'Converter input never leaves your device. The Check cookie and credential pages are different: the paste is encrypted in the browser, then sent to this site’s backend and to Anthropic. The site also records anonymous usage statistics — which formats are converted and how often — through Yandex Metrika. There is no Google Analytics.',
      },
      {
        q: 'Which JSON format should I pick?',
        a: 'Cookie-Editor if you are importing back into a browser extension. Puppeteer if you are feeding page.setCookie() or context.addCookies(). Key-value for a requests or axios session. Header if you just need something to paste after curl -H.',
      },
      {
        q: 'Why does a converted line start with #HttpOnly_?',
        a: 'That prefix is how curl marks an http-only cookie in a cookies.txt file. It looks like a comment so older readers skip it safely, while curl and yt-dlp understand it. Cookies without the flag are written normally.',
      },
      {
        q: 'What does an expiry of 0 or -1 mean?',
        a: 'Both mean a session cookie — one that dies when the browser closes. Netscape files write 0, Puppeteer writes -1, and Cookie-Editor drops the field and sets session to true instead. All three are read correctly and converted to whichever spelling the target format expects.',
      },
      {
        q: 'Why do the key-value and header formats lose data?',
        a: 'They only store names and values. Domain, path, expiry, secure and http-only have nowhere to go. That is fine when you are attaching cookies to a single request, but you cannot convert back to a complete cookies.txt afterwards without supplying a domain.',
      },
      {
        q: 'Can I take cookies from a browser extension into yt-dlp or curl?',
        a: 'Yes — that is the most common reason people land here. Export from Cookie-Editor as JSON, paste it in, and the output is a Netscape cookies.txt file you can pass to yt-dlp --cookies or curl -b.',
      },
    ],
  },

  footer: {
    tagline: 'A cookie format converter that runs entirely in your browser.',
    tools: 'Tools',
    converter: 'Converter',
    checker: 'Session check',
    credentials: 'Credentials',
    guides: 'Guides',
    docs: 'Docs',
    disclaimer:
      'Not affiliated with, endorsed by, or connected to Anthropic. Claude is a trademark of Anthropic PBC.',
    geoAttribution: 'IP geolocation by DB-IP',
    rights: 'All rights reserved.',
  },

  localeHint: {
    message: 'This page is available in English.',
    accept: 'Switch',
    dismiss: 'Stay here',
  },

  check: {
    eyebrow: 'Check session',
    title: 'Is this Claude session still valid?',
    subtitle:
      'Paste a Netscape or JSON export. The check reads the account, plan, and the 5-hour and weekly usage windows — the same numbers Claude shows in Settings.',
    inputLabel: 'Cookie file',
    placeholder:
      'Netscape cookies.txt or a JSON cookie array. sessionKey / sessionKeyV3 is required. Paste several, or drop files, to check them as a batch.',
    submit: 'Check session',
    checking: 'Checking…',
    clear: 'Clear',
    batchHeading: 'Checked',
    valid: 'Session valid',
    invalid: 'Session not valid',
    trustEncrypt: 'Encrypted in the browser',
    trustSend: 'Sent only for verification',
    trustLine: 'Encrypted in your browser before it is sent',
    formatsHint: 'Netscape · JSON · sessionKey',
    upload: 'Upload',
    chooseFiles: 'Choose files',
    dropHere: 'Drop cookie files',
    fileTooLarge: 'That file is too large. The limit is 2 MB.',
    readError: 'That file could not be read.',
    downloadValid: 'Download valid',
    downloadValidEach: 'Download each valid',
    downloadThis: 'Download',
    reasons: {
      empty: 'Paste a cookie file first.',
      missing_session: 'No Claude sessionKey was found in this file.',
      expired: 'Claude rejected this session. Export a fresh cookie from a logged-in browser.',
      unreachable: 'Claude did not answer. Try again in a moment.',
      rate_limited: 'Too many checks from this address. Wait a minute and try again.',
    },
    email: 'Email',
    name: 'Name',
    plan: 'Plan',
    session: 'Session usage (5h)',
    weekly: 'Weekly usage',
    used: 'used',
    resets: 'resets',
    unknownWindow: 'Claude did not return this window',
    error: 'The check did not complete. Try again.',
    readsTitle: 'What the check reads',
    reads: [
      {
        title: 'Account & plan',
        body: 'The email on the session and which Claude plan it belongs to — Free, Pro, or Max.',
      },
      {
        title: '5-hour window',
        body: 'How much of the current 5-hour usage window is spent, and when it resets.',
      },
      {
        title: 'Weekly window',
        body: 'The same for the rolling weekly limit Claude enforces on paid plans.',
      },
    ],
    formatsTitle: 'Formats it accepts',
    formatsBody:
      'A Netscape cookies.txt export, a JSON cookie array (Cookie-Editor or Puppeteer), or a raw Cookie: header. Only sessionKey / sessionKeyV3 is required.',
    privacyNote:
      'The paste is encrypted in your browser, then sent to this site’s backend and to Anthropic to run the check.',
    privacyLink: 'How this is handled',
    apiHint: 'Need this from a script? The same check is available as a public JSON API.',
    apiHintLink: 'API documentation',
    howTitle: 'How to get your Claude session cookie',
    howSteps: [
      {
        title: 'Open claude.ai while logged in',
        body: 'In your browser, open DevTools (F12) → Application → Cookies → https://claude.ai and copy the sessionKey (or sessionKeyV3) value. Or use the Cookie-Editor extension → Export → JSON to grab the whole set at once.',
      },
      {
        title: 'Paste it above',
        body: 'Drop the cookies.txt or JSON export into the box, or paste just the sessionKey line. The paste is encrypted in your browser before it is sent — only the sessionKey / sessionKeyV3 is actually required.',
      },
      {
        title: 'Read the result',
        body: 'The checker calls Claude with the cookie and reports whether the session is still valid, the account email and plan (Free, Pro or Max), and how much of the 5-hour and weekly usage windows are left.',
      },
    ],
    faqTitle: 'Claude cookie & session — questions',
    faq: [
      {
        q: 'What is a Claude sessionKey?',
        a: 'It is the cookie claude.ai sets when you sign in — a long token (sessionKey, or the newer sessionKeyV3) that authenticates your browser to Claude. Anyone who has it can act as your account, so treat it like a password. Claude Code stores the equivalent credential as an OAuth token in ~/.claude/.credentials.json rather than as this cookie.',
      },
      {
        q: 'sessionKey or sessionKeyV3 — which do I need?',
        a: 'Either one. Both are session cookies claude.ai sets; sessionKeyV3 is the newer format and some accounts have both. The checker reads whichever is present — only one is required.',
      },
      {
        q: 'How long does a Claude sessionKey last?',
        a: 'Roughly 30 days, unless it is revoked sooner. It rotates — and the old value stops working — when you log out, change your password, or sign out of your other sessions. After any of those you need a fresh export.',
      },
      {
        q: 'Does checking a cookie invalidate it?',
        a: 'No. The check only reads the account, plan and usage windows; it does not log you out or rotate the key. It runs one lightweight request, the same one claude.ai makes to draw your usage screen.',
      },
      {
        q: 'Why does Claude say “session expired” or “run /login”?',
        a: 'The token Claude holds is dead. Common causes: it aged out (the ~30-day cookie, or an access token that failed its background refresh), you changed your password, you signed out elsewhere, an admin revoked sessions, or your system clock is wrong. One more to check in Claude Code: an ANTHROPIC_API_KEY environment variable competing with your subscription login. The reliable fix is /logout then /login; if it loops, delete ~/.claude/.credentials.json and sign in again.',
      },
      {
        q: 'What do the 5-hour and weekly windows mean?',
        a: 'Claude Pro and Max meter usage two ways: a rolling 5-hour session window and a fixed weekly window, and that usage is shared across claude.ai, Claude Code and Claude Desktop. The 5-hour window resets five hours after your first message in it; the weekly window resets on a fixed day and time shown in Settings → Usage. This checker shows how much of each you have spent.',
      },
      {
        q: 'Can I use this cookie with Claude Code?',
        a: 'Claude Code signs in through its own OAuth flow (/login) and stores its credential in ~/.claude/.credentials.json, not as a pasted cookie. This page checks a claude.ai browser session — the same account — so it is useful for confirming your session is alive and seeing the plan and limits Claude Code will be subject to.',
      },
      {
        q: 'Is it safe to paste my cookie here?',
        a: 'Converter input never leaves your device. The session check is different: it has to send the cookie to this site’s backend and to Anthropic, so the paste is encrypted in the browser first. Only ever paste cookies for an account you control, and read the privacy page for exactly what happens.',
      },
    ],
  },

  credential: {
    inputLabel: 'Cookie file',
    placeholder:
      'Netscape cookies.txt or a JSON cookie array. sessionKey / sessionKeyV3 is required. Paste several to check them as a batch.',
    submit: 'Verify session',
    checking: 'Checking…',
    converting: 'Generating…',
    clear: 'Clear',
    convert: 'Generate credentials',
    cancel: 'Cancel',
    stepPaste: 'Paste',
    stepVerify: 'Verify',
    stepGenerate: 'Generate',
    pasteTitle: 'Paste your Claude cookie',
    verified: 'Session verified',
    ready: 'Credentials ready',
    placeAt: 'Place at',
    captchaHint: 'Complete the check below to start the conversion.',
    resultTitle: 'Credential file',
    copy: 'Copy',
    copied: 'Copied',
    save: 'Download file',
    secretNote:
      'This file is a live login. Save it as ~/.claude/.credentials.json and treat it like a password. Close the tab when you are done.',
    batchHeading: 'Checked',
    error: 'The conversion did not complete. Try again.',
    reasons: {
      empty: 'Paste a cookie file first.',
      missing_session: 'No Claude sessionKey was found in this file.',
      expired: 'Claude rejected this session. Export a fresh cookie from a logged-in browser.',
      unreachable: 'Claude did not answer. Try again in a moment.',
      rate_limited: 'Too many attempts from this address. Wait a minute and try again.',
      captcha_failed: 'The captcha did not pass. Try again.',
      convert_failed: 'The session is valid, but a credential file could not be built.',
      reauth:
        'Claude accepted the session, but will not mint tokens until you sign in again in the browser. Export a cookie from that fresh login.',
      no_refresh:
        'Claude issued an access token without a refresh token. That file would die immediately, so it was not saved.',
      no_plan:
        'The session is valid, but Claude Code only mints tokens for Pro, Max or Team. A Free account cannot produce a credentials file.',
    },
  },

  moreTools: {
    title: 'More tools',
    checkTitle: 'Check Claude session',
    checkBody: 'Verify your session and see plan + usage limits.',
    checkCta: 'Open checker',
    credTitle: 'Create Claude credentials',
    credBody: 'Turn a valid session into .credentials.json',
    credCta: 'Create credentials',
  },

  common: {
    skipToContent: 'Skip to content',
    home: 'Home',
    tools: 'Tools',
    cookieFormats: 'Cookie formats',
    minRead: 'min read',
    guideBadge: 'Guide',
    onThisPage: 'On this page',
    example: 'Example',
    field: 'Field',
    meaning: 'Meaning',
    values: 'Values',
    format: 'Format',
    usedBy: 'Used by',
    storesDomain: 'Domain',
    storesExpiry: 'Expiry',
    storesFlags: 'Flags',
    yes: 'Yes',
    no: 'No',
    tryIt: 'Try it in the converter',
  },

  pages: {
    netscape: {
      title: 'The Netscape cookies.txt format',
      intro:
        'The format every command-line tool still speaks. One cookie per line, seven fields, separated by tabs — not spaces. Lines beginning with # are comments, with one deliberate exception.',
      chips: ['7 fields', 'Tab-separated', 'One cookie per line'],
      tabWarningTitle: 'Tabs, not spaces',
      tabWarningBody: 'Strict readers may reject files where tabs were replaced with spaces.',
      fieldsTitle: 'The seven fields',
      fields: [
        {
          name: 'domain',
          meaning: 'The host the cookie belongs to. A leading dot means it also applies to subdomains.',
          values: '.example.com',
        },
        {
          name: 'includeSubdomains',
          meaning: 'Whether subdomains are included. Redundant with the leading dot, and readers disagree on which wins — we trust the dot.',
          values: 'TRUE or FALSE',
        },
        {
          name: 'path',
          meaning: 'The URL path the cookie is scoped to.',
          values: '/ or /app',
        },
        {
          name: 'secure',
          meaning: 'Whether the cookie is only sent over HTTPS.',
          values: 'TRUE or FALSE',
        },
        {
          name: 'expires',
          meaning: 'Expiry as a unix timestamp in seconds. Zero means a session cookie.',
          values: '1767225600 or 0',
        },
        { name: 'name', meaning: 'The cookie name.', values: 'session_id' },
        {
          name: 'value',
          meaning: 'The cookie value, taken verbatim to the end of the line. It may contain = and ; freely.',
          values: 'abc123',
        },
      ],
      httpOnlyTitle: 'The #HttpOnly_ prefix',
      httpOnlyBody:
        'The original format has no way to express an http-only cookie, so curl added one: prefix the domain with #HttpOnly_. Because the line then starts with a hash, readers that do not understand it treat it as a comment and skip it rather than choking. curl, wget and yt-dlp all understand it.',
      gotchasTitle: 'Things that catch people out',
      gotchas: [
        'The separator is a tab. Pasting a file through a chat window or a web form frequently turns tabs into spaces, which breaks strict readers. This converter parses those files anyway and warns you.',
        'The value runs to the end of the line, so it can contain = and ; without escaping. Splitting on those characters will corrupt JWTs and base64 values.',
        'An expiry in the past is still a valid line. Tools will simply ignore the cookie, which looks identical to the cookie not being there at all.',
        'Some writers omit the trailing tab when the value is empty, leaving six fields instead of seven.',
        'yt-dlp and other readers reject a file with “does not look like a netscape format cookies file” when the Netscape header or the tab separators are missing. Paste it here and download a normalised cookies.txt.',
      ],
      toolsTitle: 'Tools that use it',
      tools: [
        { name: 'curl', body: 'curl -b cookies.txt to send, -c cookies.txt to save.' },
        { name: 'wget', body: '--load-cookies and --save-cookies.' },
        { name: 'yt-dlp', body: '--cookies cookies.txt, the usual reason for converting a browser export.' },
        { name: 'Python requests', body: 'Via http.cookiejar.MozillaCookieJar.' },
      ],
    },

    json: {
      title: 'JSON cookie formats',
      intro:
        'There is no single JSON cookie format. Four shapes are in common use, and they store different amounts of information. This is what each one looks like and what it can hold.',
      mappingTitle: 'What each format can store',
      formatsTitle: 'The four shapes',
      entries: [
        {
          id: 'cookie-editor',
          tab: 'Cookie-Editor',
          title: 'Cookie-Editor and EditThisCookie',
          body: 'What the browser extensions export. The most complete of the four: it stores every attribute a browser cookie has, including hostOnly and the session flag. sameSite uses the words no_restriction, lax, strict and unspecified.',
          usedBy: 'Cookie-Editor, EditThisCookie, Cookie Quick Manager',
        },
        {
          id: 'puppeteer',
          tab: 'Puppeteer',
          title: 'Puppeteer and Playwright',
          body: 'What page.setCookie() and context.addCookies() accept. Expiry is called expires and uses -1 for session cookies. sameSite uses the HTTP spelling: None, Lax and Strict. Omitting sameSite lets the browser apply its own default, so we leave it out when it is unspecified.',
          usedBy: 'Puppeteer, Playwright, Selenium wrappers',
        },
        {
          id: 'key-value',
          tab: 'Key-value',
          title: 'Key-value map',
          body: 'A flat object of names to values. This is what you hand to a requests session or an axios config. It stores nothing else at all — no domain, no expiry, no flags.',
          usedBy: 'Python requests, axios, fetch wrappers',
        },
        {
          id: 'header',
          tab: 'Header',
          title: 'Cookie header string',
          body: 'Not JSON, but it belongs in the same conversation: the literal value of a Cookie request header. Pairs joined by a semicolon and a space. This is what you paste after curl -H or into Postman.',
          usedBy: 'curl, Postman, HTTPie, browser DevTools',
        },
      ],
      lossTitle: 'Converting between them loses information',
      lossBody:
        'Going from a complete format to key-value or a header is one-way: the domain, path, expiry and flags have nowhere to be stored. Converting back gives you session cookies with whatever domain you supply. The converter warns you when a conversion would drop data.',
    },

    privacy: {
      title: 'Privacy',
      updated: 'Last updated',
      intro:
        'Cookies are credentials. A session cookie is often enough to log in as you. Converter input never leaves your device. The session check and credential tools encrypt the paste in the browser, then send it to this site and to Anthropic.',
      summary: [
        { label: 'Converter', note: 'Never leaves your browser', leaves: false },
        { label: 'Session checker', note: 'Encrypted and sent for verification', leaves: true },
        { label: 'Credentials', note: 'Verified server-side, tokens are not stored', leaves: true },
        { label: 'Public API', note: 'Paste is sent to this site over HTTPS', leaves: true },
      ],
      flows: {
        converterTitle: 'Converter',
        converterSteps: ['Your browser', 'Parse / convert', 'Output'],
        converterNote: 'Never leaves your device',
        checkTitle: 'Check session and credentials',
        checkSteps: ['Your browser', 'Encrypted paste', 'This site’s backend', 'Anthropic', 'Result'],
        checkNote: 'Encrypted in the browser before it is sent',
      },
      sections: [
        {
          title: 'The conversion happens in your browser',
          body: 'Every parser and serialiser on this site is JavaScript that runs on your machine. The cookie parsing and formatting is done entirely on your device, not on a server.',
        },
        {
          title: 'The Claude session check leaves your browser',
          body: 'The Check cookie page sends an encrypted paste to this site’s own backend. That backend calls Claude with the session cookie to read the account, plan and usage windows.',
        },
        {
          title: 'Getting a credential file also leaves your browser',
          body: 'The credential page first runs the same encrypted check. If you then convert, the paste goes to this site’s backend and to Anthropic so a Claude Code credentials file can be minted. The file is returned to your browser. OAuth tokens are not stored on the server. Convert is gated by a Cloudflare Turnstile captcha.',
        },
        {
          title: 'The public API sends the paste to the server',
          body: 'POST /api/v1/convert, /api/v1/check and /api/v1/credential accept JSON over HTTPS. Unlike the website converter, the convert route parses on the server. Check and credential call Anthropic the same way the website tools do. Use only a session you control.',
        },
        {
          title: 'Anonymous usage statistics',
          body: 'The site records anonymous statistics about how it is used — which formats are converted and how often — through Yandex Metrika. There is no Google Analytics, and nothing that identifies you is stored for that purpose.',
        },
        {
          title: 'No third-party trackers',
          body: 'There is no Google Analytics and no tag manager. The site loads Yandex Metrika for first-party usage statistics — pageviews and the conversion goals on this site. The only cookie this site sets itself is cclang, which remembers the language you picked so you are not redirected by geolocation on your next visit. It contains one of three values: en, ru or zh.',
        },
        {
          title: 'What the server logs',
          body: 'The web server keeps standard access logs — IP address, timestamp, requested path, user agent. Those logs do not include the contents of a paste. Converter input never leaves your device. Checker and credential pastes are encrypted in the browser before they are sent.',
        },
        {
          title: 'Language and geolocation',
          body: 'Your approximate country is derived from your IP address by the web server, using an offline database, purely to redirect a first visit to the matching language. No location data is stored and nothing is sent to a third-party geolocation service.',
        },
        {
          title: 'Still, be sensible',
          body: 'If you are pasting live session cookies for an account that matters, close the tab when you are done, and remember that anything you copy sits in your clipboard afterwards. Treat exported cookie files the way you would treat a password file.',
        },
      ],
      disclaimerTitle: 'Not affiliated with Anthropic',
      disclaimerBody:
        'This is an independent open tool. It is not made by, endorsed by, or connected to Anthropic PBC in any way. Claude is a trademark of Anthropic PBC, used here only to refer to it.',
    },

    credential: {
      title: 'Create a credentials file',
      badge: 'Claude Code',
      intro:
        'Verify the account first, then generate ~/.claude/.credentials.json from your Claude session.',
      leadTitle: 'How it works',
      steps: [
        {
          title: 'Paste your cookie',
          body: 'Netscape, JSON, or a raw Cookie header. sessionKey or sessionKeyV3 is enough. Several sets can be checked together.',
        },
        {
          title: 'Confirm the session',
          body: 'A valid paste shows the email, plan, and the 5-hour and weekly limits before anything is converted.',
        },
        {
          title: 'Convert and save',
          body: 'Pass the captcha, then copy or download .credentials.json and put it at ~/.claude/.credentials.json.',
        },
      ],
      note: 'Only paste a session you control. The credential file is a live login — treat it like a password and close the tab when you are done.',
      apiHint: 'Need this from a script? The same convert is available as a public JSON API.',
      apiHintLink: 'API documentation',
    },

    claudeCodeLogin: {
      title: 'Claude Code keeps logging out: fixing “session expired, run /login”',
      intro:
        'Claude Code stops mid-task with “Your session has expired. Please run /login”, or it silently drops back to a login prompt every few hours. Here is what that message actually means and the fixes that work, in order.',
      updated: '2026-09-14',
      readMinutes: 6,
      sections: [
        {
          title: 'What “session expired” actually means',
          body:
            'Claude Code does not use your password on every request. When you run /login it completes a browser sign-in and stores an OAuth token in ~/.claude/.credentials.json (or your OS keychain). That access token is short-lived and is refreshed in the background using a longer-lived refresh token.\n\n“Your session has expired. Please run /login” means the token Claude Code holds is dead and the background refresh was refused. It is not a bug in your code or your prompt — it is an authentication state that has to be re-established.',
        },
        {
          title: 'The fix that works most of the time: /logout then /login',
          body:
            'Inside Claude Code, run /login and complete the browser sign-in. If that alone does not stick, run /logout first to discard the stale credentials, then /login again from a clean state. A clean logout-then-login cycle resolves the large majority of cases.\n\nIf the browser step opens but never completes, copy the authorization URL into a browser where you are already signed in to claude.ai, approve it, and paste the code back into the terminal.',
        },
        {
          title: 'If it loops or comes back within hours',
          body:
            'When /login succeeds but you are logged out again soon after, the refresh itself is failing. Common causes: you changed your Anthropic password, you signed out of claude.ai (or “sign out of all sessions”) elsewhere, an admin or the account revoked sessions, the machine was asleep or offline past the refresh window, or the system clock is wrong — a clock that has drifted makes a valid token look expired.\n\nFix the underlying cause first: set the clock to sync automatically, and avoid signing out of every session on the web while Claude Code is running. Then do one clean /logout → /login.',
        },
        {
          title: 'The ANTHROPIC_API_KEY trap',
          body:
            'The single most common cause of a login that “won’t stick” is an ANTHROPIC_API_KEY environment variable set in your shell profile. Claude Code will prefer the API key over your subscription login, and that pay-as-you-go key can be expired, rate-limited or scoped differently — which surfaces as auth errors even though your subscription is fine.\n\nCheck for it with `echo $ANTHROPIC_API_KEY` (macOS/Linux) or `echo %ANTHROPIC_API_KEY%` (Windows). If it is set and you meant to use your Pro/Max subscription, remove it from your shell profile (~/.zshrc, ~/.bashrc, or the Windows environment variables) and restart the terminal, then /login.',
        },
        {
          title: 'Last resort: delete the credentials file',
          body:
            'If /logout → /login still loops, the stored credential is corrupt — a partially written ~/.claude/.credentials.json, or a macOS Keychain entry that is locked or not writable. Close Claude Code, delete ~/.claude/.credentials.json, reopen, and run /login to re-authenticate from scratch. On macOS you may also need to remove the “Claude Code” item from Keychain Access.\n\nThis file holds live credentials — treat it like a password file, and never paste its contents into a chat or a screenshot.',
        },
        {
          title: 'Check whether your session is actually alive',
          body:
            'Before you spend time on fixes, it helps to know whether the underlying claude.ai session is still valid at all — the same account Claude Code signs into. Export your claude.ai session cookie and run it through the checker below: it tells you in seconds whether the session is live, which plan it is on, and how much of your 5-hour and weekly limits are left, so you can tell an expired session apart from a hit usage limit.',
        },
      ],
      faqTitle: 'Claude Code login — questions',
      faq: [
        {
          q: 'How long does a Claude Code login last?',
          a: 'The refresh token behind /login is good for roughly 30 days of activity, but the access token it mints is short-lived and refreshes in the background. In practice you should only have to run /login again every few weeks — if it is every few hours, something is blocking the refresh (see the ANTHROPIC_API_KEY and clock causes above).',
        },
        {
          q: 'Does reinstalling Claude Code fix the login?',
          a: 'Rarely — reinstalling does not clear ~/.claude/.credentials.json, so a corrupt credential survives. Deleting that file (or the keychain entry) and running /login is the targeted fix; reinstalling is only needed if the binary itself is broken.',
        },
        {
          q: 'Is my subscription being charged when this happens?',
          a: 'No. A session/login error does not consume usage or money. But if an ANTHROPIC_API_KEY is set, Claude Code may be billing that API key per token instead of using your subscription — which is a reason to remove it if you intended to use Pro or Max.',
        },
        {
          q: 'API key or subscription login — which should I use?',
          a: 'For interactive coding on a Pro/Max plan, use the subscription login (/login) and make sure ANTHROPIC_API_KEY is unset. Use an API key only for automation or CI where you want metered pay-as-you-go billing and no browser step.',
        },
        {
          q: 'Why does Claude Code log out after sleep or on a VPN?',
          a: 'A machine asleep or offline past the refresh window lets the token lapse, and a VPN or proxy can make the refresh call fail or look like a new location. Reconnect, make sure the clock is correct, and run /login once from a stable connection.',
        },
      ],
      sourcesTitle: 'Sources',
      sources: [
        { label: 'Claude Code — Error reference (code.claude.com/docs)', url: 'https://code.claude.com/docs/en/errors' },
        { label: 'Anthropic Help Center — signing in to Claude Code', url: 'https://support.anthropic.com/' },
      ],
      ctaTitle: 'Is your Claude session still alive?',
      ctaBody:
        'Paste your claude.ai session cookie and see in seconds whether it is valid, the plan, and your remaining 5-hour and weekly usage.',
      ctaLabel: 'Check your cookie',
    },

    claudeUsage: {
      title: 'Claude 5-hour limit vs weekly usage, and when they reset',
      intro:
        'Claude Pro and Max cap usage with two separate windows, and hitting “Claude usage limit reached” with no clear reason is one of the most common frustrations. Here is exactly how the two limits work, why one pool drains faster than you expect, and when each resets.',
      updated: '2026-09-14',
      readMinutes: 8,
      sections: [
        {
          title: 'Two limits: a rolling 5-hour window and a fixed weekly window',
          body:
            'Every paid Claude plan meters usage two ways at once. The 5-hour window is a rolling session limit: it starts with your first message and caps how much you can send over the next five hours. The weekly window is a separate, larger cap over a seven-day period.\n\nYou can hit either one. Running into the 5-hour cap pauses you for a few hours; running into the weekly cap pauses you until the week resets, and a five-hour wait will not bring it back.',
        },
        {
          title: 'It is one shared pool across claude.ai, Claude Code and Desktop',
          body:
            'The single most surprising thing: usage is not counted per app. Messages in the claude.ai web app, in Claude Code, and in the Claude desktop app all draw from the same limit. A heavy Claude Code session in the morning can leave you rate-limited in the web app in the afternoon.\n\nModel choice matters too — Opus-class models consume the pool far faster than smaller ones, which is why Max users on the biggest model can hit limits that Pro users rarely see.',
        },
        {
          title: 'When does it reset?',
          body:
            'The 5-hour window resets five hours after the first message that opened it — it rolls, so it is always “five hours from when you started”, not a fixed clock time.\n\nThe weekly window resets on a fixed schedule tied to your account, not rolling. The exact day and time are shown in Settings → Usage on claude.ai (for example “Sat 12:30 AM”); it is account-specific, so there is no single universal reset time. If you hit the weekly cap, that fixed reset is the only thing that restores it.',
        },
        {
          title: 'Pro, Max 5× and Max 20×',
          body:
            'The plans differ mainly in how large those windows are. Pro ($20/mo) is sized for everyday chat and light coding. Max at 5× and 20× multiply the caps for heavy Claude Code use. Because everything shares one pool, the practical question is not “which app” but “how much total, on which model” — the /cost command in Claude Code shows what the current session has spent.',
        },
        {
          title: 'See your own usage right now',
          body:
            'The numbers that matter are your own, and you do not have to open claude.ai to read them. Export your claude.ai session cookie and run it through the checker below — it reports your plan and exactly how much of the 5-hour and weekly windows you have used, and when each resets. That is the fastest way to tell whether you are actually rate-limited or just hit a transient error.',
        },
      ],
      faqTitle: 'Claude usage limits — questions',
      faq: [
        {
          q: 'Why did I hit the weekly limit so fast?',
          a: 'Almost always because the weekly pool is shared across claude.ai, Claude Code and Desktop, and a large-model (Opus-class) Claude Code session burns it quickly. Check what is spending it with /cost in Claude Code, and consider a smaller model for routine work.',
        },
        {
          q: 'Does switching to a smaller model help?',
          a: 'Yes. Smaller/faster models consume the shared pool much more slowly than the largest model, so switching for routine edits meaningfully extends how far your 5-hour and weekly windows stretch.',
        },
        {
          q: 'Does the API have the same limits?',
          a: 'No. The 5-hour and weekly windows apply to the Pro/Max subscription. The API is metered separately as pay-as-you-go by tokens — which is also why an ANTHROPIC_API_KEY set in your shell can quietly bill you instead of using your subscription.',
        },
        {
          q: 'Can I check my usage without opening claude.ai?',
          a: 'Yes — paste your session cookie into the checker on this site and it reports your plan and both usage windows. It reads the same numbers claude.ai shows in Settings → Usage.',
        },
        {
          q: 'What is the difference between the 5-hour and weekly reset?',
          a: 'The 5-hour window rolls (five hours after your first message); the weekly window is fixed to a day and time on your account, shown in Settings → Usage. Hitting the weekly cap can only be cleared by that fixed weekly reset.',
        },
      ],
      sourcesTitle: 'Sources',
      sources: [
        { label: 'Anthropic Help Center — usage limits', url: 'https://support.anthropic.com/' },
        { label: 'Claude Code — usage & the /cost command (code.claude.com/docs)', url: 'https://code.claude.com/docs/en/costs' },
      ],
      ctaTitle: 'How much of your limit is left?',
      ctaBody:
        'Paste your claude.ai session cookie and read your plan plus exactly how much of the 5-hour and weekly windows you have used, and when they reset.',
      ctaLabel: 'Check your usage',
    },

    api: {
      title: 'Public API for convert, check, and credentials',
      intro:
        'Call the same convert, session check, and credentials.json tools from curl or a script. No API key. JSON over HTTPS, with published rate limits.',
      updated: '2026-09-18',
      readMinutes: 6,
      badge: 'HTTP JSON',
      openapiLabel: 'OpenAPI description (openapi.json)',
      convertTitle: 'Convert cookie formats',
      convertBody:
        'POST a paste as { "input", "target?" }. With no target the API flips Netscape to Cookie-Editor JSON and every other format back to Netscape, the same default as the website. Several accounts in one paste are split, converted one by one, and stored as separate convert events.\n\nOptional defaultDomain is applied to header and key-value pastes that have no domain.',
      convertCaption: 'POST /api/v1/convert',
      checkTitle: 'Check a Claude session',
      checkBody:
        'POST { "cookie" } or a batch { "cookies": ["…"] } of at most 10. The response is the same public shape as the website: ok, plan, email, and the 5-hour and weekly windows — never extras, never the cookie. A paste without sessionKey or sessionKeyV3 is not stored.',
      checkCaption: 'POST /api/v1/check',
      credentialTitle: 'Mint credentials.json',
      credentialBody:
        'POST { "cookie" } for a single set. The server checks the session, then runs the Claude Code OAuth convert. A failed check returns 200 with invalidReason and does not write a credential row. OAuth tokens are returned to you and are not stored. Free accounts cannot mint.',
      credentialCaption: 'POST /api/v1/credential',
      healthTitle: 'Health',
      healthBody: 'GET returns { "ok": true }. Use it to see that the ingest process is up. It does not expose internals.',
      healthCaption: 'GET /api/v1/health',
      limitsTitle: 'Rate limits',
      limitsIntro:
        'Nginx caps the whole /api/v1/ prefix at 10 requests per second. The ingest process then applies the same per-IP budgets as the website for check and credential, so one address cannot double its allowance by using both surfaces.',
      limitName: 'Route',
      limitValue: 'Budget',
      limits: [
        { name: 'All /api/v1/*', value: '10 requests per second per IP, burst 20' },
        { name: 'POST /api/v1/convert', value: '60 requests per minute per IP' },
        { name: 'POST /api/v1/check', value: '20 requests per minute per IP, shared with the website' },
        { name: 'POST /api/v1/credential', value: '5 per minute and 20 per hour per IP; 3 per hour per sessionKey' },
      ],
      reasonsTitle: 'invalidReason values',
      reasonsIntro:
        'Errors use HTTP 400, 403 or 429 plus { "ok": false, "invalidReason" }. 429 includes Retry-After in seconds.',
      reasonCode: 'Code',
      reasonMeaning: 'Meaning',
      reasons: [
        { code: 'empty', meaning: 'Missing or blank paste.' },
        { code: 'unknown_format', meaning: 'Convert could not detect a cookie format.' },
        { code: 'bad_target', meaning: 'target is not one of the five supported formats.' },
        { code: 'missing_session', meaning: 'No sessionKey or sessionKeyV3 in the paste.' },
        { code: 'rate_limited', meaning: 'This IP or sessionKey hit a published budget.' },
        { code: 'unreachable', meaning: 'Claude did not answer, or no safe egress proxy is available.' },
        { code: 'expired', meaning: 'Claude rejected the session.' },
        { code: 'reauth', meaning: 'Claude wants a fresh browser login before minting tokens.' },
        { code: 'no_plan', meaning: 'The account has no Pro or Max plan.' },
        { code: 'too_large', meaning: 'The body is larger than the 512 KB ingest limit.' },
      ],
      faqTitle: 'API questions',
      faq: [
        {
          q: 'Do I need an API key?',
          a: 'No. The v1 routes are public. Abuse is handled with the rate limits on this page. If that is not enough later, keys would be a separate change.',
        },
        {
          q: 'Does convert stay in the browser?',
          a: 'On the website, yes. On POST /api/v1/convert the paste is sent to this site over HTTPS and parsed on the server. Use the web converter when you do not want the paste to leave the device.',
        },
        {
          q: 'Is a valid check written to the same log as the website?',
          a: 'Yes. Check and credential use the same warehouse as the pages. Convert writes one event per successful set, then may run a quiet background check on that set. Empty pastes and missing sessionKey are not stored.',
        },
        {
          q: 'Can I batch credential?',
          a: 'No. Credential is one cookie set per request. Check accepts up to 10 sets. Convert accepts up to 40 sets in one paste.',
        },
        {
          q: 'Why did credential return reauth on a cookie that checks as valid?',
          a: 'Claude can accept a session for usage and still refuse to mint OAuth tokens until you sign in again in the browser. Export a cookie from that fresh login.',
        },
      ],
      sourcesTitle: 'Sources',
      ctaTitle: 'Prefer the website tools?',
      ctaBody: 'The check page runs the same session read, with the paste encrypted in the browser first.',
      ctaLabel: 'Check a cookie',
      copyCurl: 'Copy',
      copied: 'Copied',
    },
  },
}

/**
 * Derived from the English object, so adding a key here immediately makes
 * `ru.ts` and `zh.ts` fail to type-check until they are translated too.
 */
export type Dictionary = typeof en
