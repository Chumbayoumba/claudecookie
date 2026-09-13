'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { PANEL_BODY_HEIGHT } from './layout'
import { TargetTabs } from './TargetTabs'
import { Button } from '@/components/ui/Button'
import { FORMAT_META, type CookieFormat } from '@/lib/cookies'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { copyText } from '@/lib/utils/clipboard'
import { cn } from '@/lib/utils/cn'
import { downloadText } from '@/lib/utils/download'
import { highlight } from '@/lib/utils/highlight'

interface OutputPanelProps {
  output: string
  target: CookieFormat
  onTargetChange: (format: CookieFormat) => void
  /** Bumped by the Convert button to flash the panel border. */
  flashKey: number
  dict: Dictionary
}

/** Which copy button last succeeded, so the tick lands on the right one. */
type CopiedKind = 'multi' | 'line' | null

const ICON = {
  check: (
    <path
      d="m3 8.5 3.2 3.2L13 5"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  copy: (
    <>
      <rect x="5.75" y="5.75" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10.25 5.75v-1.5a1.5 1.5 0 0 0-1.5-1.5h-4.5a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5h1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </>
  ),
  // A single horizontal rule, to read as "one line".
  line: (
    <path d="M2.5 8h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  ),
}

function CopyGlyph({ children }: { children: React.ReactNode }) {
  return (
    <span className="grid size-4 place-items-center">
      <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
        {children}
      </svg>
    </span>
  )
}

export function OutputPanel({
  output,
  target,
  onTargetChange,
  flashKey,
  dict,
}: OutputPanelProps) {
  const [copied, setCopied] = useState<CopiedKind>(null)
  const [flash, setFlash] = useState(false)
  const meta = FORMAT_META[target]
  const firstRender = useRef(true)

  const highlighted = useMemo(() => highlight(output, meta.syntax), [output, meta.syntax])

  /**
   * A single-line version of the output, for the "copy line" button.
   *
   * Only meaningful for JSON, where it is just the same data without the
   * pretty-printing that makes a Cookie-Editor export scroll for pages. A
   * Netscape file is line-based - one cookie per line - so collapsing it would
   * corrupt it, and a Cookie header is already a single line; in both cases the
   * button is hidden rather than offered as a no-op.
   */
  const oneLine = useMemo(() => {
    if (meta.syntax !== 'json' || !output.trim()) return null
    try {
      return JSON.stringify(JSON.parse(output))
    } catch {
      return null
    }
  }, [output, meta.syntax])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(null), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  // Pulse the border when Convert is pressed explicitly. Skipping the first run
  // keeps the panel from flashing on page load.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setFlash(true)
    const timer = setTimeout(() => setFlash(false), 700)
    return () => clearTimeout(timer)
  }, [flashKey])

  async function copy(text: string, kind: Exclude<CopiedKind, null>) {
    if (await copyText(text)) setCopied(kind)
  }

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col rounded-large border bg-surface',
        // The pulse fades out slowly, so a fast transition in and a slow one
        // out reads as a flash rather than a colour change.
        flash ? 'border-clay duration-0' : 'border-line duration-700',
        'transition-colors ease-ant',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
          {dict.converter.outputLabel}
        </span>
        <TargetTabs value={target} onChange={onTargetChange} dict={dict} />
      </div>

      <div className={cn('ant-scroll relative overflow-auto', PANEL_BODY_HEIGHT)}>
        {output ? (
          <pre
            className={cn(
              'px-4 py-4 font-mono text-detail-s leading-relaxed text-ink',
              // `break-all` keeps long JWT values from forcing a horizontal scroll.
              'break-all whitespace-pre-wrap',
              meta.syntax === 'json' ? 'ant-json' : 'ant-netscape',
            )}
          >
            {highlighted !== null ? (
              <code dangerouslySetInnerHTML={{ __html: highlighted }} />
            ) : (
              <code>{output}</code>
            )}
          </pre>
        ) : (
          <p className="px-4 py-4 font-mono text-detail-s text-ink-faint">
            {dict.converter.outputPlaceholder}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => copy(output, 'multi')}
          disabled={!output}
        >
          <CopyGlyph>{copied === 'multi' ? ICON.check : ICON.copy}</CopyGlyph>
          {copied === 'multi' ? dict.converter.copied : dict.converter.copy}
        </Button>

        {/* Shown only for JSON, where a one-line copy is both meaningful and safe. */}
        {oneLine !== null && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => copy(oneLine, 'line')}
            disabled={!output}
          >
            <CopyGlyph>{copied === 'line' ? ICON.check : ICON.line}</CopyGlyph>
            {copied === 'line' ? dict.converter.copied : dict.converter.copyLine}
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          disabled={!output}
          onClick={() => downloadText(output, meta.filename, meta.mime)}
        >
          {dict.converter.download}
        </Button>

        <span className="ms-auto font-mono text-detail-xs text-ink-faint">{meta.filename}</span>
      </div>
    </div>
  )
}
