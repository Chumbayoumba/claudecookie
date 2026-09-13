/**
 * Minimal syntax colouring for the read-only output panel.
 *
 * A real tokenizer would be a lot of JavaScript for a box nobody types into, so
 * this is regex-based and deliberately shallow. Input is escaped first, so the
 * result is safe to hand to `dangerouslySetInnerHTML`.
 */

/** Above this, highlighting costs more than it is worth and we render plain text. */
export const HIGHLIGHT_LIMIT = 200_000

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const JSON_TOKEN =
  /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g

export function highlightJson(code: string): string {
  return escapeHtml(code).replace(
    JSON_TOKEN,
    (match, str: string | undefined, colon: string | undefined, bool: string | undefined, num: string | undefined) => {
      if (str !== undefined) {
        // A string followed by a colon is a key, otherwise it is a value.
        return colon
          ? `<span class="tok-key">${str}</span><span class="tok-punc">${colon}</span>`
          : `<span class="tok-str">${str}</span>`
      }
      if (bool !== undefined) return `<span class="tok-bool">${bool}</span>`
      if (num !== undefined) return `<span class="tok-num">${num}</span>`
      return match
    },
  )
}

export function highlightNetscape(code: string): string {
  return code
    .split('\n')
    .map((line) => {
      // `#HttpOnly_` looks like a comment but is a real cookie line.
      if (line.startsWith('#') && !line.startsWith('#HttpOnly_')) {
        return `<span class="tok-comment">${escapeHtml(line)}</span>`
      }

      const fields = line.split('\t')
      if (fields.length < 7) return escapeHtml(line)

      return fields
        .map((field, i) => {
          const safe = escapeHtml(field)
          if (i === 1 || i === 3) return `<span class="tok-flag">${safe}</span>`
          if (i === 4) return `<span class="tok-num">${safe}</span>`
          return safe
        })
        .join('\t')
    })
    .join('\n')
}

export function highlight(code: string, syntax: 'json' | 'text'): string | null {
  if (!code || code.length > HIGHLIGHT_LIMIT) return null
  return syntax === 'json' ? highlightJson(code) : highlightNetscape(code)
}
