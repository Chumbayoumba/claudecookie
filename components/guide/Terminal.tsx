/**
 * A stylized terminal window illustration in the Claude Code aesthetic.
 *
 * Rendered as real, themed markup (not a raster image): it is crawlable text,
 * needs no external asset (the CSP forbids third-party images anyway), and scales
 * cleanly. Terminal chrome is intentionally always-dark — a terminal reads as a
 * terminal in either site theme — with the brand clay used for the prompt caret.
 *
 * Lines are locale-neutral by design: CLI commands and Claude's own output
 * (`/login`, "Your session has expired") are identical in every language, so one
 * terminal serves all three locales.
 */

type LineKind = 'cmd' | 'out' | 'err' | 'ok' | 'cmt'

export interface TermLine {
  k: LineKind
  t: string
}

const LINE_CLASS: Record<LineKind, string> = {
  cmd: 'text-[#ededec]',
  out: 'text-[#a3a29e]',
  err: 'text-[#f0857d]',
  ok: 'text-[#7fd1a3]',
  cmt: 'text-[#6b6a66]',
}

export function Terminal({ title = 'claude', lines }: { title?: string; lines: TermLine[] }) {
  return (
    <div className="overflow-hidden rounded-large border border-[#33322f] bg-[#1a1a18] shadow-[0_12px_40px_-12px_rgba(20,20,19,0.45)]">
      <div className="flex items-center gap-2 border-b border-[#2a2926] bg-[#242320] px-4 py-2.5">
        <span className="size-3 rounded-full bg-[#f0857d]" aria-hidden />
        <span className="size-3 rounded-full bg-[#e5c07b]" aria-hidden />
        <span className="size-3 rounded-full bg-[#7fd1a3]" aria-hidden />
        <span className="ms-2 font-mono text-detail-xs text-[#8a8984]">{title}</span>
      </div>
      <div className="ant-scroll overflow-x-auto px-4 py-4">
        <pre className="font-mono text-detail-s leading-relaxed">
          {lines.map((line, i) => (
            <div key={i} className={LINE_CLASS[line.k]}>
              {line.k === 'cmd' && <span className="text-[#d97757]">❯ </span>}
              {line.t || ' '}
            </div>
          ))}
        </pre>
      </div>
    </div>
  )
}
