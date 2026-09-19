'use client'

import { AnimatePresence, motion } from 'motion/react'
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { CheckingBar } from './CheckingBar'
import { TrustRow } from './TrustRow'
import { UsageCard } from './UsageCard'
import { joinCookieSets, MAX_INPUT_BYTES, MAX_SETS } from '@/lib/cookies'
import { splitCookieSets } from '@/lib/cookies/split'
import { metrikaGoal } from '@/lib/analytics'
import { cookieFileSlug, validCookieFiles } from '@/lib/check/filename'
import { postChecks } from '@/lib/check/request'
import type { CheckResult } from '@/lib/check/types'
import { SITE_URL } from '@/lib/i18n/config'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { Button } from '@/components/ui/Button'
import { Pill } from '@/components/ui/Pill'
import { cn } from '@/lib/utils/cn'
import { downloadText } from '@/lib/utils/download'
import { downloadZip } from '@/lib/utils/zip'

const EASE = [0.165, 0.84, 0.44, 1] as const
const RISE = { duration: 0.24, ease: EASE } as const

interface CheckerProps {
  locale: Locale
  dict: Dictionary
}

interface CheckRow {
  raw: string
  result: CheckResult
}

function reasonText(dict: Dictionary, reason?: string): string {
  const reasons = dict.check.reasons
  if (reason && reason in reasons) {
    return reasons[reason as keyof typeof reasons]
  }
  return dict.check.error
}

export function Checker({ locale, dict }: CheckerProps) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<CheckRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)

  useEffect(() => {
    if (!fileError) return
    const timer = setTimeout(() => setFileError(null), 6000)
    return () => clearTimeout(timer)
  }, [fileError])

  async function readFiles(files: File[]) {
    const picked = files.slice(0, MAX_SETS)
    if (picked.some((f) => f.size > MAX_INPUT_BYTES)) {
      setFileError(dict.check.fileTooLarge)
      return
    }
    try {
      const texts = await Promise.all(picked.map((f) => f.text()))
      const incoming = joinCookieSets(texts)
      if (!incoming) return
      setValue((current) => (current.trim() ? joinCookieSets([current, incoming]) : incoming))
      setFileError(null)
    } catch {
      setFileError(dict.check.readError)
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFailed(false)
    setBusy(true)
    metrikaGoal('check_started')
    try {
      const sets = splitCookieSets(value)
      const source = sets.length > 0 ? sets : [value]
      const out = await postChecks(source, locale)
      if (out.length === 0) {
        setRows(null)
        setFailed(true)
        metrikaGoal('check_failed')
      } else {
        const paired = source.slice(0, out.length).map((raw, i) => ({
          raw,
          result: out[i]!,
        }))
        setRows(paired)
        metrikaGoal(paired.every((r) => r.result.ok) ? 'check_valid' : 'check_invalid')
      }
    } catch {
      setRows(null)
      setFailed(true)
      metrikaGoal('check_failed')
    } finally {
      setBusy(false)
    }
  }

  const validRows = rows?.filter((r) => r.result.ok) ?? []

  function downloadJoined() {
    if (validRows.length === 0) return
    if (validRows.length === 1) {
      downloadOne(validRows[0]!)
      return
    }
    downloadText(joinCookieSets(validRows.map((r) => r.raw)), 'valid-cookies.txt', 'text/plain')
  }

  function downloadEach() {
    const files = validCookieFiles(
      validRows.map((r) => ({
        raw: r.raw,
        email: r.result.email,
        plan: r.result.planLabel,
      })),
    )
    if (files.length === 0) return
    if (files.length === 1) {
      downloadText(files[0]!.text, files[0]!.name, 'text/plain')
      return
    }
    downloadZip(files, 'valid-cookies.zip')
  }

  function downloadOne(row: CheckRow) {
    const name = `${cookieFileSlug(row.result.email, row.result.planLabel)}.txt`
    downloadText(row.raw, name, 'text/plain')
  }

  function shareCheck() {
    const url = `${SITE_URL}/check?utm_source=share&utm_medium=referral`
    metrikaGoal('check_shared')
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({ title: 'claudecookie', text: dict.check.shareText, url })
        .catch(() => {
          void navigator.clipboard?.writeText(url)
        })
    } else {
      void navigator.clipboard?.writeText(url)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
            'relative overflow-hidden rounded-large border border-line bg-surface',
            'transition-colors duration-200 ease-ant hover:border-line-strong',
            busy && 'border-clay/35',
            dragging && 'border-clay/50 bg-clay/5',
          )}
        >
          <div className="flex min-h-11 min-w-0 flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
            <label
              htmlFor="claude-cookie"
              className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase"
            >
              {dict.check.inputLabel}
            </label>
            <div className="ms-auto flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => fileInput.current?.click()}
                className="text-ink-faint"
              >
                <UploadIcon />
                {dict.check.upload}
              </Button>
            </div>
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
          <CheckingBar active={busy} />
          <textarea
            id="claude-cookie"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={dict.check.placeholder}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            data-gramm="false"
            rows={10}
            className={cn(
              'ant-scroll block h-[min(38vh,18rem)] w-full resize-y bg-transparent px-4 py-4',
              'font-mono text-detail-s leading-relaxed text-ink',
              'placeholder:text-ink-faint focus:outline-none',
            )}
          />
          <p className="border-t border-line px-4 py-2.5 font-sans text-detail-xs text-ink-faint">
            {fileError ?? dict.check.formatsHint}
          </p>
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute inset-0 grid place-items-center bg-surface/80',
              'transition-opacity duration-200 ease-ant',
              dragging ? 'opacity-100' : 'opacity-0',
            )}
          >
            <span className="font-sans text-detail-l font-medium text-ink">{dict.check.dropHere}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="accent" size="lg" disabled={busy}>
            {busy ? dict.check.checking : dict.check.submit}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy || (!value && !rows)}
            onClick={() => {
              setValue('')
              setRows(null)
              setFailed(false)
              setFileError(null)
            }}
          >
            {dict.check.clear}
          </Button>
        </div>

        <TrustRow line={dict.check.trustLine} />
      </form>

      <AnimatePresence initial={false}>
        {failed ? (
          <motion.div
            key="failed"
            initial={{ y: 8 }}
            animate={{ y: 0 }}
            exit={{ y: 6 }}
            transition={RISE}
          >
            <StatusCard tone="error" title={dict.check.error} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false} mode="wait">
        {rows ? (
          <motion.div
            key={`n${rows.length}-${rows[0]?.result.ok ? 'v' : 'x'}`}
            initial={{ y: 8 }}
            animate={{ y: 0 }}
            exit={{ y: 6 }}
            transition={RISE}
            className="flex flex-col gap-4"
          >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              {rows.length > 1 ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-detail-s text-ink-secondary">
                  <span>
                    {dict.check.batchHeading}: <b className="text-ink">{rows.length}</b>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-ok">
                    <MarkOk />
                    {validRows.length}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-error">
                    <MarkBad />
                    {rows.length - validRows.length}
                  </span>
                </div>
              ) : (
                <span />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={shareCheck}>
                  {dict.check.share}
                </Button>
                {validRows.length > 0 ? (
                  <Button type="button" size="sm" variant="secondary" onClick={downloadJoined}>
                    {dict.check.downloadValid}
                  </Button>
                ) : null}
                {validRows.length > 1 ? (
                  <Button type="button" size="sm" variant="ghost" onClick={downloadEach}>
                    {dict.check.downloadValidEach}
                  </Button>
                ) : null}
              </div>
            </div>
            {rows.map((row, i) => (
              <CheckReport
                key={i}
                result={row.result}
                dict={dict}
                onDownload={row.result.ok ? () => downloadOne(row) : undefined}
              />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function CheckReport({
  result,
  dict,
  footer,
  onDownload,
}: {
  result: CheckResult
  dict: Dictionary
  footer?: ReactNode
  onDownload?: () => void
}) {
  if (!result.ok) {
    return (
      <StatusCard
        tone="error"
        title={dict.check.invalid}
        body={reasonText(dict, result.invalidReason)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-large border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Pill tone="ok">
            <CheckIcon />
            {dict.check.valid}
          </Pill>
          <div className="flex flex-wrap items-center gap-2">
            {result.planLabel ? <Pill tone="accent">{result.planLabel}</Pill> : null}
            {onDownload ? (
              <Button type="button" size="sm" variant="ghost" onClick={onDownload}>
                {dict.check.downloadThis}
              </Button>
            ) : null}
          </div>
        </div>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="font-sans text-detail-xs tracking-[0.06em] text-ink-faint uppercase">
              {dict.check.email}
            </dt>
            <dd
              className="mt-1 truncate font-sans text-detail-l text-ink"
              title={result.email || undefined}
            >
              {result.email || '—'}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-sans text-detail-xs tracking-[0.06em] text-ink-faint uppercase">
              {dict.check.name}
            </dt>
            <dd className="mt-1 truncate font-sans text-detail-l text-ink">{result.name || '—'}</dd>
          </div>
        </dl>

        <div className="mt-6 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
          <UsageCard title={dict.check.session} window={result.session} dict={dict} />
          <UsageCard title={dict.check.weekly} window={result.weekly} dict={dict} />
        </div>
      </section>

      {footer ? <div className="flex flex-col gap-3">{footer}</div> : null}
    </div>
  )
}

function StatusCard({
  tone,
  title,
  body,
}: {
  tone: 'error' | 'ok'
  title: string
  body?: string
}) {
  return (
    <section
      className={cn(
        'rounded-large p-5 sm:p-6',
        tone === 'error' ? 'border border-error/30 bg-error/8' : 'border border-line bg-surface',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 grid size-9 shrink-0 place-items-center rounded-main',
            tone === 'error'
              ? 'border border-error/30 bg-error/10 text-error'
              : 'border border-line bg-bg-secondary text-ok',
          )}
        >
          {tone === 'error' ? <MarkBad /> : <MarkOk />}
        </span>
        <div>
          <h3 className="font-sans text-detail-l font-medium text-ink">{title}</h3>
          {body ? (
            <p className="mt-1.5 max-w-[52ch] text-paragraph-xs text-ink-secondary">{body}</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" aria-hidden>
      <path
        d="M3.5 8.5 6.5 11.5 12.5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

/** Custom count marks (no emoji): a ringed check and a ringed cross in currentColor. */
function MarkOk() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" opacity="0.35" />
      <path
        d="m5 8.2 2.1 2.1L11 6.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MarkBad() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" opacity="0.35" />
      <path
        d="m5.8 5.8 4.4 4.4M10.2 5.8 5.8 10.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
