'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { UsageCard } from './UsageCard'
import { sealJson } from '@/lib/box'
import type { CheckResult, InvalidReason } from '@/lib/check/types'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

const EASE = [0.165, 0.84, 0.44, 1] as const

interface CheckerProps {
  locale: Locale
  dict: Dictionary
}

function reasonText(dict: Dictionary, reason?: string): string {
  const reasons = dict.check.reasons
  if (reason && reason in reasons) {
    return reasons[reason as InvalidReason]
  }
  return dict.check.error
}

export function Checker({ locale, dict }: CheckerProps) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)
  const [failed, setFailed] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFailed(false)
    setBusy(true)
    try {
      const box = await sealJson({ cookie: value, l: locale })
      const response = await fetch('/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(box),
      })
      const data = (await response.json()) as CheckResult
      setResult(data)
    } catch {
      setResult(null)
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <motion.form
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="rounded-large border border-line bg-surface">
          <div className="border-b border-line px-4 py-3">
            <label
              htmlFor="claude-cookie"
              className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase"
            >
              {dict.check.inputLabel}
            </label>
          </div>
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
            rows={12}
            className={cn(
              'ant-scroll min-h-[220px] w-full resize-y bg-transparent px-4 py-4',
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
            disabled={!value && !result}
            onClick={() => {
              setValue('')
              setResult(null)
              setFailed(false)
            }}
          >
            {dict.check.clear}
          </Button>
        </div>
      </motion.form>

      <AnimatePresence initial={false}>
        {failed ? (
          <motion.p
            key="failed"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="rounded-large border border-line bg-surface px-5 py-4 font-sans text-detail-m text-error"
          >
            {dict.check.error}
          </motion.p>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false} mode="wait">
        {result ? (
          <motion.div
            key={result.ok ? 'valid' : `invalid-${result.invalidReason ?? 'x'}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <CheckReport result={result} dict={dict} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function CheckReport({ result, dict }: { result: CheckResult; dict: Dictionary }) {
  if (!result.ok) {
    return (
      <section className="rounded-large border border-line bg-surface p-6">
        <p className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-error uppercase">
          {dict.check.invalid}
        </p>
        <p className="mt-3 text-paragraph-xs text-ink-secondary">
          {reasonText(dict, result.invalidReason)}
        </p>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-large border border-line bg-surface p-6">
        <p className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ok uppercase">
          {dict.check.valid}
        </p>
        <dl className="mt-5 grid gap-5 sm:grid-cols-3">
          <div>
            <dt className="font-sans text-detail-xs text-ink-faint">{dict.check.email}</dt>
            <dd className="mt-1 break-all font-sans text-detail-l text-ink">
              {result.email || '—'}
            </dd>
          </div>
          <div>
            <dt className="font-sans text-detail-xs text-ink-faint">{dict.check.plan}</dt>
            <dd className="mt-1 font-sans text-detail-l text-ink">{result.planLabel || '—'}</dd>
          </div>
          <div>
            <dt className="font-sans text-detail-xs text-ink-faint">{dict.check.name}</dt>
            <dd className="mt-1 font-sans text-detail-l text-ink">{result.name || '—'}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <UsageCard title={dict.check.session} window={result.session} dict={dict} />
        <UsageCard title={dict.check.weekly} window={result.weekly} dict={dict} />
      </div>
    </div>
  )
}
