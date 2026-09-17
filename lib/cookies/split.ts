import { detectFormat } from './detect'
import { cleanInput } from './normalize'

/**
 * Splits a paste that may contain several *separate* cookie sets into one string
 * per set, so 5–10 different exports pasted together can be parsed/checked/converted
 * one by one. Conservative: a single set (the common case) returns `[input]`, so the
 * existing single-set path is unchanged. Never returns more than `MAX_SETS` entries.
 *
 * Boundaries, in order:
 *   1. Several JSON values concatenated (`[...][...]`, `}{`, JSON-lines).
 *   2. Netscape cookie dumps: split whenever a cookie NAME repeats (each account's
 *      names restart), which handles dumps separated by blank lines, by a repeated
 *      `# Netscape` header, on their own newlines, or even glued together with no
 *      separator (a preprocess re-breaks glued cookie lines).
 *   3. Blank-line-separated blocks (each a real format), for mixed pastes.
 *   4. One header string per line.
 */
export const MAX_SETS = 20

const HEADER_LINE = /^\s*(?:(?:set-)?cookie\s*:\s*)?[^=;,\s]+=[^;]*(?:;\s*[^=;,\s]+=[^;]*)*$/i
// A netscape cookie line glued onto the previous line: `<domain>\t(TRUE|FALSE)\t`
// not at the start of a line. Used to re-insert the missing newline.
const GLUED_NETSCAPE = /([^\n\t])((?:\.?[A-Za-z0-9][\w.-]*\.[A-Za-z]{2,})\t(?:TRUE|FALSE)\t)/g

export function splitCookieSets(input: string): string[] {
  const text = cleanInput(input).trim()
  if (!text) return []

  // 1. Multiple concatenated JSON values.
  if (text[0] === '[' || text[0] === '{') {
    const values = scanTopLevelJson(text)
    return values.length > 1 ? cap(values) : [text]
  }

  // 2. Netscape dumps — split by repeated cookie name (robust to any separator).
  //    Only take this split when it actually finds >1 dump; otherwise fall through
  //    to the blank-line/header handling below (e.g. a netscape + header mix).
  if (detectFormat(text).format === 'netscape') {
    const byName = splitNetscapeByName(text.replace(GLUED_NETSCAPE, '$1\n$2'))
    if (byName.length > 1) return cap(byName)
  }

  // 3. Blank-line-separated blocks — only when each block is a real cookie format.
  const blocks = text
    .split(/\n[ \t]*\n+/)
    .map((b) => b.trim())
    .filter(Boolean)
  if (blocks.length > 1 && blocks.every(isRealSet)) {
    return cap(blocks)
  }

  // 4. One header string per line.
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  if (lines.length > 1 && lines.every((l) => HEADER_LINE.test(l))) {
    return cap(lines)
  }

  return [text]
}

/** The cookie name (field 6) of a Netscape line, tab- or space-delimited; else null. */
function netscapeName(line: string): string | null {
  const body = line.replace(/^#HttpOnly_/, '')
  const tabs = body.split('\t')
  if (tabs.length >= 7) return tabs[5]?.trim() || null
  const sp = body.split(/\s+/)
  if (sp.length >= 7 && isBoolField(sp[1]) && isBoolField(sp[3])) return sp[5]?.trim() || null
  return null
}

const NETSCAPE_HEADER_LINE = /^#\s*(?:Netscape\s+HTTP\s+Cookie\s+File|HTTP\s+Cookie\s+File)/i

/**
 * Start a new set at each account boundary: either a repeated `# Netscape` header,
 * or a cookie NAME already seen in the current set (each dump's names restart).
 * Handles blank-line-separated, header-separated, newline-separated and glued dumps.
 */
function splitNetscapeByName(text: string): string[] {
  const groups: string[] = []
  let cur: string[] = []
  let seen = new Set<string>()

  const flush = () => {
    if (seen.size > 0) {
      groups.push(cur.join('\n').trim())
      cur = []
      seen = new Set()
    }
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      if (cur.length) cur.push(line)
      continue
    }
    if (NETSCAPE_HEADER_LINE.test(trimmed)) {
      flush() // a new `# Netscape` header begins a new dump
      cur.push(line)
      continue
    }
    if (trimmed.startsWith('#')) {
      if (cur.length) cur.push(line)
      continue
    }
    const name = netscapeName(trimmed)
    if (name && seen.has(name)) flush()
    if (name) seen.add(name)
    cur.push(line)
  }
  if (cur.length && cur.some((l) => l.trim())) groups.push(cur.join('\n').trim())
  return groups.filter(Boolean)
}

/** Scan a string of concatenated JSON values, returning each complete top-level value. */
function scanTopLevelJson(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i)
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      if (start === -1) start = i
      continue
    }
    if (ch === '{' || ch === '[') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}' || ch === ']') {
      depth--
      if (depth === 0 && start !== -1) {
        out.push(text.slice(start, i + 1).trim())
        start = -1
      } else if (depth < 0) {
        return []
      }
    } else if (depth === 0 && start !== -1 && !isWs(ch)) {
      return []
    }
  }
  return depth === 0 && !inString ? out : []
}

/** A block is a real cookie set only if it has a non-comment content line and detects. */
function isRealSet(block: string): boolean {
  const hasContent = block.split('\n').some((l) => l.trim() && !l.trim().startsWith('#'))
  return hasContent && detectFormat(block).format !== null
}

function isBoolField(v: string | undefined): boolean {
  return v === 'TRUE' || v === 'FALSE' || v === 'true' || v === 'false'
}

function isWs(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r'
}

function cap(sets: string[]): string[] {
  return sets.slice(0, MAX_SETS)
}
