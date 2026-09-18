'use client'

import { type ChangeEvent, type DragEvent, useRef, useState } from 'react'
import { FormatBadge } from './FormatBadge'
import { DEFAULT_EDITOR_PX } from './layout'
import { Button } from '@/components/ui/Button'
import { joinCookieSets, MAX_INPUT_BYTES, MAX_SETS, type CookieFormat } from '@/lib/cookies'
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
  editorHeight: number
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
  editorHeight,
}: InputPanelProps) {
  const [dragging, setDragging] = useState(false)
  const [focused, setFocused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const dragDepth = useRef(0)
  const empty = value.trim().length === 0
  const mac = isMacPlatform()

  async function readFiles(files: File[]) {
    const picked = files.slice(0, MAX_SETS)
    if (picked.some((f) => f.size > MAX_INPUT_BYTES)) {
      onFileError(dict.converter.fileTooLarge)
      return
    }
    try {
      const texts = await Promise.all(picked.map((f) => f.text()))
      const incoming = joinCookieSets(texts)
      if (!incoming) return
      onChange(value.trim() ? joinCookieSets([value, incoming]) : incoming)
    } catch {
      onFileError(dict.converter.readError)
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const files = [...e.dataTransfer.files]
    if (files.length) void readFiles(files)
  }

  function onFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    if (files.length) void readFiles(files)
    e.target.value = ''
  }

  function focusEditor() {
    textarea.current?.focus()
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
      className="relative flex min-w-0 flex-1 flex-col bg-pane-input"
    >
      <div className="flex min-w-0 flex-col gap-1 px-3 py-2 sm:px-4">
        <div className="flex min-h-8 min-w-0 items-center gap-2">
          <span className="shrink-0 font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
            {dict.converter.inputLabel}
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
        </div>
        {!empty ? (
          <div className="flex min-h-8 min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <FormatBadge
              format={detected}
              confidence={confidence}
              hasInput
              cookieCount={cookieCount}
              locale={locale}
              dict={dict}
            />
            <span
              className="inline-flex shrink-0 items-center gap-1 font-sans text-detail-xs text-ink-faint"
              title={dict.converter.localTooltip}
            >
              <LockIcon />
              {dict.converter.localBadge}
            </span>
          </div>
        ) : null}
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".txt,.json,text/plain,application/json"
          onChange={onFilePicked}
          className="hidden"
          tabIndex={-1}
        />
      </div>

      <label className="sr-only" htmlFor="cookie-input">
        {dict.converter.inputLabel}
      </label>
      <div className="px-3 pb-3 sm:px-4">
        <div
          onClick={focusEditor}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={cn(
            'relative flex flex-col overflow-hidden rounded-main bg-pane-editor',
            'border border-pane-editor-line',
            'transition-[border-color,box-shadow,background-color] duration-200 ease-ant',
            hovered && !focused && !dragging && 'border-pane-editor-line-hover',
            focused && 'shadow-[inset_0_0_0_1px_rgba(200,102,72,0.30)]',
            dragging && 'border-clay/50 bg-clay/5',
          )}
          style={{ height: editorHeight || DEFAULT_EDITOR_PX }}
        >
          <textarea
            id="cookie-input"
            ref={textarea}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder=""
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            data-gramm="false"
            className={cn(
              'ant-scroll min-h-0 w-full flex-1 resize-none bg-transparent px-4 py-3',
              'font-mono text-detail-s leading-relaxed text-ink',
              'focus:outline-none',
              empty && 'caret-ink',
            )}
          />

          {empty && !dragging && (
            <div className="pointer-events-none absolute inset-0 flex flex-col">
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
                <MotionArrow />
                <p className="font-sans text-detail-l font-medium text-ink">{dict.converter.placeholder}</p>
                <p className="font-sans text-detail-s text-ink-faint">
                  {mac ? dict.converter.emptyHintMac : dict.converter.emptyHintWin}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="pointer-events-auto mt-1 h-[34px]"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInput.current?.click()
                  }}
                >
                  <UploadIcon />
                  {dict.converter.chooseFile}
                </Button>
                <p className="font-mono text-detail-xs text-ink-faint">{dict.converter.formatsChip}</p>
              </div>
              <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 pb-2.5">
                <p
                  className="inline-flex items-center gap-1.5 font-sans text-detail-xs text-ink-faint"
                  title={dict.converter.localTooltip}
                >
                  <LockIcon />
                  {dict.converter.staysInBrowser}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-sans text-detail-xs text-ink-faint">{dict.converter.tryExample}</span>
                  {(['cookie-editor', 'netscape'] as const).map((kind) => (
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
            </div>
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
