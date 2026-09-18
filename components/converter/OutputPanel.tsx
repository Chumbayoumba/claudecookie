'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_EDITOR_PX } from './layout'
import { TargetTabs } from './TargetTabs'
import { Button } from '@/components/ui/Button'
import { FORMAT_META, type CookieFormat } from '@/lib/cookies'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { plural } from '@/lib/i18n/plural'
import { copyText } from '@/lib/utils/clipboard'
import { cn } from '@/lib/utils/cn'
import { metrikaGoal } from '@/lib/analytics'
import { downloadText } from '@/lib/utils/download'
import { highlight } from '@/lib/utils/highlight'

interface OutputPanelProps {
  output: string
  target: CookieFormat
  onTargetChange: (format: CookieFormat) => void
  flashKey: number
  cookieCount: number
  locale: Locale
  dict: Dictionary
  editorHeight: number
  /** `set` hides the OUTPUT label and format tabs — the batch toolbar owns those. */
  chrome?: 'full' | 'set'
}

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
  line: <path d="M2.5 8h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />,
  download: (
    <path
      d="M8 3.5v8m0 0L5 8.5M8 11.5l3-3M3 13h10"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
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
  cookieCount,
  locale,
  dict,
  editorHeight,
  chrome = 'full',
}: OutputPanelProps) {
  const [copied, setCopied] = useState<CopiedKind>(null)
  const [flash, setFlash] = useState(false)
  const meta = FORMAT_META[target]
  const firstRender = useRef(true)
  const visible = Boolean(output)

  const highlighted = useMemo(() => highlight(output, meta.syntax), [output, meta.syntax])

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
    const timer = setTimeout(() => setCopied(null), 1200)
    return () => clearTimeout(timer)
  }, [copied])

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setFlash(true)
    const timer = setTimeout(() => setFlash(false), 500)
    return () => clearTimeout(timer)
  }, [flashKey])

  async function copy(text: string, kind: Exclude<CopiedKind, null>) {
    if (await copyText(text)) {
      setCopied(kind)
      metrikaGoal('output_copied')
    }
  }

  const countLabel =
    cookieCount > 0 ? `${cookieCount} ${plural(locale, cookieCount, dict.stats.cookies)}` : dict.formats[target].label

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col bg-pane-output',
        'transition-[box-shadow,background-color] ease-ant',
        flash ? 'duration-0 shadow-[inset_0_0_0_1px_rgba(200,102,72,0.35)]' : 'duration-500',
      )}
    >
      <div className="flex min-w-0 flex-col gap-1 px-3 py-2 sm:px-4">
        {chrome === 'full' ? (
          <div className="flex min-h-8 min-w-0 items-center gap-2">
            <span className="shrink-0 font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
              {dict.converter.outputLabel}
            </span>
            <div className="ms-auto min-w-0">
              <TargetTabs value={target} onChange={onTargetChange} dict={dict} />
            </div>
          </div>
        ) : null}
        {visible ? (
          <div className="flex min-h-8 min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="min-w-0 font-sans text-detail-xs text-ink-faint">
              <span aria-hidden className="me-1.5 inline-block size-1.5 rounded-round bg-ok align-middle" />
              {countLabel}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-0.5">
              <Button size="sm" variant="ghost" onClick={() => copy(output, 'multi')}>
                <CopyGlyph>{copied === 'multi' ? ICON.check : ICON.copy}</CopyGlyph>
                {copied === 'multi' ? dict.converter.copied : dict.converter.copy}
              </Button>

              {oneLine !== null && (
                <Button size="sm" variant="ghost" onClick={() => copy(oneLine, 'line')}>
                  <CopyGlyph>{copied === 'line' ? ICON.check : ICON.line}</CopyGlyph>
                  {copied === 'line' ? dict.converter.copied : dict.converter.copyLine}
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                title={meta.filename}
                onClick={() => {
                  downloadText(output, meta.filename, meta.mime)
                  metrikaGoal('output_downloaded')
                }}
              >
                <CopyGlyph>{ICON.download}</CopyGlyph>
                {dict.converter.download}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="px-3 pb-3 sm:px-4">
        <div
          className={cn(
            'relative overflow-x-hidden overflow-y-auto rounded-main bg-pane-editor',
            'border border-pane-editor-line',
          )}
          style={{ height: editorHeight || DEFAULT_EDITOR_PX }}
        >
          {visible ? (
            <pre
              className={cn(
                'max-w-full px-4 py-3 font-mono text-detail-s leading-relaxed text-ink',
                'overflow-x-hidden break-all whitespace-pre-wrap [overflow-wrap:anywhere]',
                meta.syntax === 'json' ? 'ant-json' : 'ant-netscape',
              )}
            >
              {highlighted !== null ? (
                <code
                  className="block max-w-full whitespace-pre-wrap break-all [overflow-wrap:anywhere]"
                  dangerouslySetInnerHTML={{ __html: highlighted }}
                />
              ) : (
                <code className="block max-w-full whitespace-pre-wrap break-all [overflow-wrap:anywhere]">{output}</code>
              )}
            </pre>
          ) : (
            <div className="grid h-full place-items-center px-6 text-center">
              <div className="flex flex-col items-center gap-1.5">
                <p className="font-sans text-detail-s text-ink-secondary">{dict.converter.outputPlaceholder}</p>
                <p className="font-sans text-detail-xs text-ink-faint">{dict.converter.outputEmptyHint}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
