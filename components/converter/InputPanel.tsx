'use client'

import { type ChangeEvent, type DragEvent, useRef, useState } from 'react'
import { FormatBadge } from './FormatBadge'
import { PANEL_BODY_HEIGHT } from './layout'
import { Button } from '@/components/ui/Button'
import { MAX_INPUT_BYTES, type CookieFormat } from '@/lib/cookies'
import type { SampleKind } from '@/lib/cookies/samples'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { cn } from '@/lib/utils/cn'

interface InputPanelProps {
  value: string
  onChange: (next: string) => void
  onSample: () => void
  onExample: (kind: SampleKind) => void
  onFileError: (message: string) => void
  detected: CookieFormat | null
  confidence: number
  cookieCount: number
  locale: Locale
  dict: Dictionary
}

function isMacPlatform() {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad/.test(navigator.platform)
}

export function InputPanel({
  value,
  onChange,
  onSample,
  onExample,
  onFileError,
  detected,
  confidence,
  cookieCount,
  locale,
  dict,
}: InputPanelProps) {
  const [dragging, setDragging] = useState(false)
  const [focused, setFocused] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const dragDepth = useRef(0)
  const empty = value.trim().length === 0
  const mac = isMacPlatform()

  async function readFile(file: File) {
    if (file.size > MAX_INPUT_BYTES) {
      onFileError(dict.converter.fileTooLarge)
      return
    }
    try {
      onChange(await file.text())
    } catch {
      onFileError(dict.converter.readError)
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void readFile(file)
  }

  function onFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void readFile(file)
    e.target.value = ''
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault()
        dragDepth.current += 1
        setDragging(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault()
        dragDepth.current -= 1
        if (dragDepth.current <= 0) setDragging(false)
      }}
      onDrop={onDrop}
      className={cn(
        'relative flex min-w-0 flex-1 flex-col bg-pane-input',
        'transition-[background-color,box-shadow] duration-200 ease-ant',
        focused && 'shadow-[inset_0_0_0_1px_rgba(200,102,72,0.30)]',
        dragging && 'bg-clay/5 shadow-[inset_0_0_0_1px_rgba(200,102,72,0.45)]',
      )}
    >
      <div className="flex flex-nowrap items-center gap-x-2 overflow-x-auto px-3 py-2 sm:px-4 border-b border-line">
        <span className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
          {dict.converter.inputLabel}
        </span>
        <FormatBadge
          format={detected}
          confidence={confidence}
          hasInput={!empty}
          cookieCount={cookieCount}
          locale={locale}
          dict={dict}
        />
        <span
          className="rounded-small px-1.5 py-0.5 font-sans text-detail-xs font-medium tracking-[0.06em] text-ink-faint uppercase"
          title={dict.converter.localTooltip}
        >
          {dict.converter.localBadge}
        </span>
        <div className="ms-auto flex shrink-0 items-center gap-0.5">
          <Button size="sm" variant="ghost" onClick={onSample} className="text-ink-faint">
            <DiamondIcon />
            {dict.converter.sample}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => fileInput.current?.click()}
            className="text-ink-faint"
          >
            <UploadIcon />
            {dict.converter.upload}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange('')}
            disabled={!value}
            className="text-ink-faint"
          >
            {dict.converter.clear}
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.json,text/plain,application/json"
          onChange={onFilePicked}
          className="hidden"
          tabIndex={-1}
        />
      </div>

      <label className="sr-only" htmlFor="cookie-input">
        {dict.converter.inputLabel}
      </label>
      <div className="relative">
        <textarea
          id="cookie-input"
          ref={textarea}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={empty ? '' : dict.converter.placeholder}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          data-gramm="false"
          className={cn(
            'ant-scroll w-full resize-none bg-transparent px-4 py-4',
            PANEL_BODY_HEIGHT,
            'font-mono text-detail-s leading-relaxed text-ink',
            'placeholder:text-ink-faint',
            'focus:outline-none',
            empty && 'caret-ink',
          )}
        />

        {empty && !dragging && (
          <div
            className={cn(
              'absolute inset-2 flex flex-col items-center justify-center gap-2 rounded-main text-center',
              'border border-dashed border-transparent transition-colors duration-200 ease-ant',
              'hover:border-pane-input-line',
            )}
            onClick={() => textarea.current?.focus()}
          >
            <MotionArrow />
            <p className="font-sans text-detail-l font-medium text-ink">{dict.converter.placeholder}</p>
            <p className="font-sans text-detail-s text-ink-faint">
              {mac ? dict.converter.emptyHintMac : dict.converter.emptyHintWin}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                fileInput.current?.click()
              }}
              className="mt-1 cursor-pointer font-sans text-detail-s text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
            >
              {dict.converter.chooseFile}
            </button>
            <p className="font-mono text-detail-xs text-ink-faint">{dict.converter.formatsChip}</p>
            <p
              className="mt-1 inline-flex items-center gap-1.5 font-sans text-detail-xs text-ink-faint"
              title={dict.converter.localTooltip}
            >
              <LockIcon />
              {dict.converter.staysInBrowser}
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              <span className="font-sans text-detail-xs text-ink-faint">{dict.converter.tryExample}</span>
              {(['cookie-editor', 'netscape', 'header'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onExample(kind)
                  }}
                  className="cursor-pointer font-sans text-detail-xs text-ink-secondary underline-offset-2 hover:text-ink hover:underline"
                >
                  {dict.formats[kind].label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-0 grid place-items-center',
            'transition-opacity duration-200 ease-ant',
            dragging ? 'opacity-100' : 'opacity-0',
          )}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <MotionArrow active={dragging} />
            <span className="font-sans text-detail-l font-medium text-ink">
              {dict.converter.dropHere}
            </span>
            <span className="font-sans text-detail-s text-ink-faint">{dict.converter.dropHint}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function MotionArrow({ active = false }: { active?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(
        'size-5 text-ink-faint transition-transform duration-200 ease-ant',
        active && 'translate-y-0.5 text-clay',
      )}
      fill="none"
      aria-hidden
    >
      <path
        d="M12 4v12m0 0-4-4m4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DiamondIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <path d="M8 2.5 13.5 8 8 13.5 2.5 8 8 2.5Z" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <path
        d="M8 11.5V3.5m0 0L5 6.5M8 3.5l3 3M3 12.5h10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <rect x="3.5" y="7.25" width="9" height="6.25" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M5.75 7.25V5.4a2.25 2.25 0 0 1 4.5 0v1.85"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}
