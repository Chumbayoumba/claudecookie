'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { PANEL_BODY_HEIGHT } from './layout'
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
  revealed: boolean
  target: CookieFormat
  onTargetChange: (format: CookieFormat) => void
  flashKey: number
  cookieCount: number
  locale: Locale
  dict: Dictionary
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
  revealed,
  target,
  onTargetChange,
  flashKey,
  cookieCount,
  locale,
  dict,
}: OutputPanelProps) {
  const [copied, setCopied] = useState<CopiedKind>(null)
  const [flash, setFlash] = useState(false)
  const meta = FORMAT_META[target]
  const firstRender = useRef(true)
  const visible = revealed && Boolean(output)

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

  const readyLabel =
    cookieCount > 0
      ? `✓ ${dict.formats[target].label} · ${cookieCount} ${plural(locale, cookieCount, dict.stats.cookies)}`
      : `✓ ${dict.converter.outputReady}`

  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col bg-pane-output',
        'transition-[box-shadow,background-color] ease-ant',
        flash ? 'duration-0 shadow-[inset_0_0_0_1px_rgba(200,102,72,0.35)]' : 'duration-500',
      )}
    >
      <div className="flex flex-nowrap items-center gap-x-2 overflow-x-auto px-3 py-2 sm:px-4 border-b border-line">
        <span className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
          {dict.converter.outputLabel}
        </span>
        {visible ? (
          <span className="inline-flex items-center gap-1.5 font-sans text-detail-xs text-ink-secondary">
            <span aria-hidden className="size-1.5 rounded-round bg-ok" />
            {readyLabel}
          </span>
        ) : null}
        <TargetTabs value={target} onChange={onTargetChange} dict={dict} />
        <div
          className={cn(
            'ms-auto flex shrink-0 items-center gap-0.5',
            'transition-opacity duration-200 ease-ant',
            visible ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <Button size="sm" variant="ghost" onClick={() => copy(output, 'multi')} disabled={!visible}>
            <CopyGlyph>{copied === 'multi' ? ICON.check : ICON.copy}</CopyGlyph>
            {copied === 'multi' ? dict.converter.copied : dict.converter.copy}
          </Button>

          {oneLine !== null && (
            <Button size="sm" variant="ghost" onClick={() => copy(oneLine, 'line')} disabled={!visible}>
              <CopyGlyph>{copied === 'line' ? ICON.check : ICON.line}</CopyGlyph>
              {copied === 'line' ? dict.converter.copied : dict.converter.copyLine}
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            disabled={!visible}
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

      <div className={cn('ant-scroll relative overflow-auto bg-transparent', PANEL_BODY_HEIGHT)}>
        {visible ? (
          <pre
            className={cn(
              'px-4 py-4 font-mono text-detail-s leading-relaxed text-ink',
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
          <p className="grid h-full place-items-center px-4 font-sans text-detail-s text-ink-faint">
            {dict.converter.outputPlaceholder}
          </p>
        )}
      </div>
    </div>
  )
}
