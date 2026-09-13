'use client'

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { FormatBadge } from './FormatBadge'
import { PANEL_BODY_HEIGHT } from './layout'
import { Button } from '@/components/ui/Button'
import { MAX_INPUT_BYTES, type CookieFormat } from '@/lib/cookies'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { cn } from '@/lib/utils/cn'

interface InputPanelProps {
  value: string
  onChange: (value: string) => void
  onSample: () => void
  onFileError: (message: string) => void
  detected: CookieFormat | null
  confidence: number
  dict: Dictionary
}

export function InputPanel({
  value,
  onChange,
  onSample,
  onFileError,
  detected,
  confidence,
  dict,
}: InputPanelProps) {
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  // Drag events fire on every child element, so a counter is needed to know
  // when the pointer has actually left the panel rather than crossed a child.
  const dragDepth = useRef(0)

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
    // Reset so picking the same file twice still fires a change event.
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
        'relative flex min-w-0 flex-1 flex-col rounded-large border bg-surface',
        'transition-[border-color,background-color] duration-200 ease-ant',
        dragging ? 'border-clay bg-clay/5' : 'border-line',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <span className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
          {dict.converter.inputLabel}
        </span>
        <FormatBadge
          format={detected}
          confidence={confidence}
          hasInput={value.trim().length > 0}
          dict={dict}
        />
      </div>

      <label className="sr-only" htmlFor="cookie-input">
        {dict.converter.inputLabel}
      </label>
      <textarea
        id="cookie-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={dict.converter.placeholder}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        data-gramm="false"
        className={cn(
          'ant-scroll resize-none bg-transparent px-4 py-4',
          PANEL_BODY_HEIGHT,
          'font-mono text-detail-s leading-relaxed text-ink',
          'placeholder:text-ink-faint',
          'focus:outline-none',
        )}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        <Button size="sm" variant="ghost" onClick={onSample}>
          {dict.converter.sample}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => fileInput.current?.click()}>
          {dict.converter.upload}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onChange('')}
          disabled={!value}
          className="ms-auto"
        >
          {dict.converter.clear}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.json,text/plain,application/json"
          onChange={onFilePicked}
          className="hidden"
          tabIndex={-1}
        />
      </div>

      {/* Drop overlay. `pointer-events-none` keeps it from eating the drop. */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 grid place-items-center rounded-large',
          'bg-bg/85 backdrop-blur-[2px] transition-opacity duration-200 ease-ant',
          dragging ? 'opacity-100' : 'opacity-0',
        )}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <svg viewBox="0 0 24 24" className="size-8 text-clay" fill="none">
            <path
              d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-sans text-detail-l font-medium text-ink">
            {dict.converter.dropHere}
          </span>
          <span className="font-mono text-detail-xs text-ink-faint">
            {dict.converter.dropHint}
          </span>
        </div>
      </div>
    </div>
  )
}
