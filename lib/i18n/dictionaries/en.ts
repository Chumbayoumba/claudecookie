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
      title: 'Cookie Converter — Netscape cookies.txt to JSON and back',
      description:
        'Convert cookies between Netscape cookies.txt and JSON (Cookie-Editor, Puppeteer, key-value, header). The format is detected automatically. Runs entirely in your browser.',
    },
    netscape: {
      title: 'The Netscape cookies.txt format, field by field',
      description:
        'What each of the seven tab-separated fields in a Netscape cookies.txt file means, how the #HttpOnly_ prefix works, and which tools read and write this format.',
    },
    json: {
      title: 'JSON cookie formats: Cookie-Editor, Puppeteer, key-value, header',
      description:
        'The four JSON shapes cookies are exported in, with examples and a field-by-field mapping table showing what each one can and cannot store.',
    },
    privacy: {
      title: 'Privacy — nothing you paste ever leaves your browser',
      description:
        'How claudecookie.com handles your data: cookies are converted in your browser, and the site keeps only anonymous usage statistics.',
    },
  },

  nav: {
    formats: 'Formats',
    netscapeFormat: 'Netscape cookies.txt',
    jsonFormat: 'JSON formats',
    faq: 'FAQ',
    privacy: 'Privacy',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    language: 'Language',
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
  },

  hero: {
    eyebrow: 'Cookie converter',
    title: 'Cookies, in whatever format you need them.',
    subtitle:
      'Netscape cookies.txt to JSON and back — Cookie-Editor, Puppeteer, key-value, or a raw Cookie header. Paste it and the format is worked out for you.',
    privacy: 'The conversion runs entirely in your browser.',
  },

  converter: {
    inputLabel: 'Input',
    outputLabel: 'Output',
    detected: 'Detected',
    detectedGuess: 'Best guess',
    awaiting: 'Waiting for input',
    unknown: 'Not recognised',
    convertTo: 'Convert to',
    convert: 'Convert',
    swap: 'Swap direction',
    copy: 'Copy',
    copyLine: 'Copy line',
    copied: 'Copied',
    download: 'Download',
    clear: 'Clear',
    sample: 'Sample',
    upload: 'Upload',
    dropHere: 'Drop your cookie file',
    dropHint: 'cookies.txt or .json',
    placeholder:
      'Paste your cookies here.\n\nA cookies.txt file, a JSON export from Cookie-Editor or Puppeteer, a plain {"name": "value"} map, or a Cookie: header — all of them work.',
    outputPlaceholder: 'The converted cookies will appear here.',
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
        a: 'The conversion itself runs entirely in JavaScript in your browser. The site records anonymous usage statistics — which formats are converted and how often — so its usage can be understood. There are no third-party analytics or trackers.',
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
    reference: 'Reference',
    about: 'About',
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

  common: {
    skipToContent: 'Skip to content',
    backToConverter: 'Back to the converter',
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
          title: 'Cookie-Editor and EditThisCookie',
          body: 'What the browser extensions export. The most complete of the four: it stores every attribute a browser cookie has, including hostOnly and the session flag. sameSite uses the words no_restriction, lax, strict and unspecified.',
          usedBy: 'Cookie-Editor, EditThisCookie, Cookie Quick Manager',
        },
        {
          id: 'puppeteer',
          title: 'Puppeteer and Playwright',
          body: 'What page.setCookie() and context.addCookies() accept. Expiry is called expires and uses -1 for session cookies. sameSite uses the HTTP spelling: None, Lax and Strict. Omitting sameSite lets the browser apply its own default, so we leave it out when it is unspecified.',
          usedBy: 'Puppeteer, Playwright, Selenium wrappers',
        },
        {
          id: 'key-value',
          title: 'Key-value map',
          body: 'A flat object of names to values. This is what you hand to a requests session or an axios config. It stores nothing else at all — no domain, no expiry, no flags.',
          usedBy: 'Python requests, axios, fetch wrappers',
        },
        {
          id: 'header',
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
        'Cookies are credentials. A session cookie is often enough to log in as you. So the only honest way to build this tool is for the data never to leave your device — and for that to be something you can verify rather than something you have to believe.',
      sections: [
        {
          title: 'The conversion happens in your browser',
          body: 'Every parser and serialiser on this site is JavaScript that runs on your machine. The cookie parsing and formatting is done entirely on your device, not on a server.',
        },
        {
          title: 'Anonymous usage statistics',
          body: 'The site records anonymous statistics about how it is used — which formats are converted and how often. This is first-party only: there is no Google Analytics, no third-party tracker, and nothing that identifies you.',
        },
        {
          title: 'No third-party trackers',
          body: 'There is no Google Analytics, no Yandex Metrica, no tag manager and no third-party script of any kind. The only cookie this site sets is cclang, which remembers the language you picked so you are not redirected by geolocation on your next visit. It contains one of three values: en, ru or zh.',
        },
        {
          title: 'What the server logs',
          body: 'The web server keeps standard access logs — IP address, timestamp, requested path, user agent — which is what any web server does and what is needed to keep it running. Those logs record that a page was requested. They cannot record what you pasted into it, because that never reaches the server.',
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
  },
}

/**
 * Derived from the English object, so adding a key here immediately makes
 * `ru.ts` and `zh.ts` fail to type-check until they are translated too.
 */
export type Dictionary = typeof en
