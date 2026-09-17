'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { CheckingBar } from './CheckingBar'
import { TrustRow } from './TrustRow'
import { UsageCard } from './UsageCard'
import { sealJson } from '@/lib/box'
import { splitCookieSets } from '@/lib/cookies/split'
import { metrikaGoal } from '@/lib/analytics'
import type { CheckResult } from '@/lib/check/types'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { Button } from '@/components/ui/Button'
import { Pill } from '@/components/ui/Pill'
import { cn } from '@/lib/utils/cn'

const EASE = [0.165, 0.84, 0.44, 1] as const

interface CheckerProps {
  locale: Locale
  dict: Dictionary
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
  const [results, setResults] = useState<CheckResult[] | null>(null)
  const [failed, setFailed] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFailed(false)
    setBusy(true)
    metrikaGoal('check_started')
    try {
      let tz: string | undefined
      try {
        tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      } catch {
        tz = undefined
      }
      // A paste of several separate cookies is split and checked as a batch;
      // a single cookie keeps the original single-object request/response.
      const sets = splitCookieSets(value)
      let out: CheckResult[]
      if (sets.length > 1) {
        const box = await sealJson({ cookies: sets, l: locale, tz })
        const response = await fetch('/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(box),
        })
        const data = (await response.json()) as { results?: CheckResult[] }
        out = Array.isArray(data.results) ? data.results : []
      } else {
        const box = await sealJson({ cookie: value, l: locale, tz })
        const response = await fetch('/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(box),
        })
        out = [(await response.json()) as CheckResult]
      }
      if (out.length === 0) {
        setResults(null)
        setFailed(true)
        metrikaGoal('check_failed')
      } else {
        setResults(out)
        metrikaGoal(out.every((r) => r.ok) ? 'check_valid' : 'check_invalid')
      }
    } catch {
      setResults(null)
      setFailed(true)
      metrikaGoal('check_failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TrustRow encrypt={dict.check.trustEncrypt} send={dict.check.trustSend} />
        <div
          className={cn(
            'overflow-hidden rounded-large border border-line bg-surface',
            'transition-colors duration-200 ease-ant hover:border-line-strong',
            busy && 'border-clay/35',
          )}
        >
          <div className="border-b border-line px-4 py-3">
            <label
              htmlFor="claude-cookie"
              className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase"
            >
              {dict.check.inputLabel}
            </label>
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
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="accent" size="lg" disabled={busy}>
            {busy ? dict.check.checking : dict.check.submit}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={!value && !results}
            onClick={() => {
              setValue('')
              setResults(null)
              setFailed(false)
            }}
          >
            {dict.check.clear}
          </Button>
        </div>
      </form>

      <AnimatePresence initial={false}>
        {failed ? (
          <motion.div
            key="failed"
            initial={{ y: 8 }}
            animate={{ y: 0 }}
            exit={{ y: 6 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            <StatusCard tone="error" title={dict.check.error} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false} mode="wait">
        {results ? (
          <motion.div
            key={`n${results.length}-${results[0]?.ok ? 'v' : 'x'}`}
            initial={{ y: 10 }}
            animate={{ y: 0 }}
            exit={{ y: 8 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="flex flex-col gap-4"
          >
            {results.length > 1 ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-detail-s text-ink-secondary">
                <span>
                  {dict.check.batchHeading}: <b className="text-ink">{results.length}</b>
                </span>
                <span className="inline-flex items-center gap-1.5 text-ok">
                  <MarkOk />
                  {results.filter((r) => r.ok).length}
                </span>
                <span className="inline-flex items-center gap-1.5 text-error">
                  <MarkBad />
                  {results.filter((r) => !r.ok).length}
                </span>
              </div>
            ) : null}
            {results.map((r, i) => (
              <CheckReport key={i} result={r} dict={dict} />
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
}: {
  result: CheckResult
  dict: Dictionary
  footer?: ReactNode
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
      <motion.section
        initial={{ y: 8 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="rounded-large border border-line bg-surface p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Pill tone="ok">
            <CheckIcon />
            {dict.check.valid}
          </Pill>
          {result.planLabel ? <Pill tone="accent">{result.planLabel}</Pill> : null}
        </div>

        <motion.dl
          initial={{ y: 8 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.3, delay: 0.06, ease: EASE }}
          className="mt-5 grid gap-5 sm:grid-cols-2"
        >
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
        </motion.dl>
      </motion.section>

      <motion.div
        initial={{ y: 8 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3, delay: 0.12, ease: EASE }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <UsageCard title={dict.check.session} window={result.session} dict={dict} />
        <UsageCard title={dict.check.weekly} window={result.weekly} dict={dict} />
      </motion.div>

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
    <section className="rounded-large border border-line bg-surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 grid size-9 shrink-0 place-items-center rounded-main border border-line bg-bg-secondary',
            tone === 'error' ? 'text-error' : 'text-ok',
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
      />
    </svg>
  )
}
