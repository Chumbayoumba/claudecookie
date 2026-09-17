'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { InputPanel } from './InputPanel'
import { IssueList } from './IssueList'
import { OutputPanel } from './OutputPanel'
import { StatsBar } from './StatsBar'
import { SwapButton } from './SwapButton'
import { Button } from '@/components/ui/Button'
import {
  convert,
  convertBatch,
  convertCombined,
  detectFormat,
  oppositeFormat,
  splitCookieSets,
  type ConvertResult,
  type CookieFormat,
  type ParseIssue,
} from '@/lib/cookies'
import { isSiteSample, sampleFor, sampleNamed, type SampleKind } from '@/lib/cookies/samples'
import { metrikaGoal, trackConvert } from '@/lib/analytics'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { plural } from '@/lib/i18n/plural'
import { cn } from '@/lib/utils/cn'

const DOMAINLESS: readonly CookieFormat[] = ['header', 'key-value']

function isMacPlatform() {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad/.test(navigator.platform)
}

export function Converter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [input, setInput] = useState('')
  const [target, setTarget] = useState<CookieFormat | null>(null)
  const [defaultDomain, setDefaultDomain] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [flashKey, setFlashKey] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [ctaDone, setCtaDone] = useState(false)
  const [combine, setCombine] = useState(false)

  const detection = useMemo(() => detectFormat(input), [input])

  const effectiveTarget: CookieFormat =
    target ?? (detection.format ? oppositeFormat(detection.format) : 'cookie-editor')

  const result = useMemo(
    () => convert(input, { target: effectiveTarget, defaultDomain: defaultDomain.trim() }),
    [input, effectiveTarget, defaultDomain],
  )

  const sets = useMemo(() => splitCookieSets(input), [input])
  const isBatch = sets.length > 1
  const batchResults = useMemo(
    () =>
      isBatch
        ? convertBatch(input, { target: effectiveTarget, defaultDomain: defaultDomain.trim() })
        : [],
    [input, effectiveTarget, defaultDomain, isBatch],
  )
  const combinedResult = useMemo(
    () =>
      isBatch && combine
        ? convertCombined(input, {
            target: effectiveTarget,
            defaultDomain: defaultDomain.trim(),
          })
        : null,
    [input, effectiveTarget, defaultDomain, isBatch, combine],
  )

  const baseIssues: ParseIssue[] = isBatch ? [] : result.issues
  const issues: ParseIssue[] = fileError
    ? [{ level: 'error', message: fileError }, ...baseIssues]
    : baseIssues

  const needsDomain =
    (detection.format !== null && DOMAINLESS.includes(detection.format)) ||
    result.issues.some((i) => i.message === 'issue.missingDomain')

  const hasInput = input.trim().length > 0
  const cookieCount = result.stats.total

  function handleInput(next: string) {
    setFileError(null)
    setInput(next)
    if (!next.trim()) {
      setTarget(null)
      setRevealed(false)
      setCtaDone(false)
      return
    }
    if (revealed) {
      setRevealed(false)
      setCtaDone(false)
    }
  }

  function record(done: ConvertResult[]) {
    let any = false
    for (const r of done) {
      if (r.ok && r.output && r.detected && !isSiteSample(r.output)) {
        trackConvert({ from: r.detected, to: r.target, n: r.stats.total, out: r.output, locale })
        any = true
      }
    }
    if (any) metrikaGoal('convert_success')
  }

  function handleConvert() {
    if (!input.trim()) return
    setRevealed(true)
    setFlashKey((k) => k + 1)
    setCtaDone(true)
    record(isBatch ? batchResults : [result])
  }

  function handleSwap() {
    if (!revealed || !result.ok || !result.output) return
    const previousSource = result.detected
    setFileError(null)
    setInput(result.output)
    setTarget(previousSource)
    setRevealed(true)
    setFlashKey((k) => k + 1)
  }

  function applyExample(sample: string) {
    setFileError(null)
    setInput(sample)
    setTarget(null)
    setRevealed(true)
    setFlashKey((k) => k + 1)
    setCtaDone(true)
  }

  function handleSample() {
    applyExample(sampleFor(detection.format))
  }

  function handleExample(kind: SampleKind) {
    applyExample(sampleNamed(kind))
  }

  useEffect(() => {
    if (!fileError) return
    const timer = setTimeout(() => setFileError(null), 6000)
    return () => clearTimeout(timer)
  }, [fileError])

  useEffect(() => {
    if (!ctaDone) return
    const timer = setTimeout(() => setCtaDone(false), 1000)
    return () => clearTimeout(timer)
  }, [ctaDone, flashKey])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        if (input.trim()) handleConvert()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const mac = isMacPlatform()
  const ctaLabel = ctaDone
    ? `✓ ${dict.converter.converted}`
    : revealed
      ? dict.converter.convertAgain
      : hasInput
        ? `${dict.converter.convertTo} ${dict.formats[effectiveTarget].label} →`
        : dict.converter.convert

  const inputPanel = (
    <InputPanel
      value={input}
      onChange={handleInput}
      onSample={handleSample}
      onExample={handleExample}
      onFileError={setFileError}
      detected={detection.format}
      confidence={detection.confidence}
      cookieCount={cookieCount}
      locale={locale}
      dict={dict}
    />
  )

  const outputProps = {
    target: effectiveTarget,
    onTargetChange: setTarget,
    flashKey,
    cookieCount,
    locale,
    dict,
  }

  return (
    <div className="relative z-10">
      <div className="flex flex-col overflow-hidden rounded-large border border-line-tool bg-surface">
        {!isBatch ? (
          <div className="relative flex min-h-0 flex-col lg:flex-row">
            <div className="min-w-0 lg:w-[48%]">{inputPanel}</div>
            <div className="relative h-px shrink-0 bg-line lg:h-auto lg:w-px lg:self-stretch">
              <div className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                <SwapButton
                  onSwap={handleSwap}
                  disabled={!revealed || !result.ok || !result.output}
                  label={dict.converter.swap}
                />
              </div>
            </div>
            <div className="min-w-0 lg:w-[52%]">
              <OutputPanel output={result.output} revealed={revealed} {...outputProps} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {inputPanel}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5">
              <span className="font-sans text-detail-s text-ink-secondary">
                <b>{sets.length}</b> {dict.converter.batchSets}
              </span>
              <div className="flex gap-1 p-0.5">
                {[
                  { on: false, label: dict.converter.separate },
                  { on: true, label: dict.converter.combine },
                ].map((opt) => (
                  <button
                    key={String(opt.on)}
                    type="button"
                    onClick={() => setCombine(opt.on)}
                    className={cn(
                      'rounded-main px-3 py-1.5 font-sans text-detail-s transition-colors duration-150 ease-ant',
                      combine === opt.on
                        ? 'bg-clay text-clay-contrast'
                        : 'text-ink-secondary hover:text-ink',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {combine && combinedResult ? (
              <OutputPanel output={combinedResult.output} revealed={revealed} {...outputProps} />
            ) : (
              <div className="flex flex-col">
                {batchResults.map((r, i) => (
                  <div key={i}>
                    <p className="px-4 pt-3 font-sans text-detail-xs text-ink-faint">
                      {dict.converter.setWord} {i + 1}
                      {r.detected ? ` · ${r.detected}` : ''}
                    </p>
                    <OutputPanel output={r.output} revealed={revealed} {...outputProps} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-line">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="min-w-0 font-sans text-detail-s text-ink-faint">
              {hasInput && detection.format ? (
                <>
                  {dict.formats[detection.format].label}
                  {cookieCount > 0
                    ? ` · ${cookieCount} ${plural(locale, cookieCount, dict.stats.cookies)}`
                    : ''}
                  <span className="ms-3">
                    {mac ? dict.converter.convertHintMac : dict.converter.convertHintWin}
                  </span>
                </>
              ) : (
                dict.converter.autoDetects
              )}
            </p>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <AnimatePresence initial={false}>
                {needsDomain && hasInput && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: 'auto' }}
                    exit={{ width: 0 }}
                    transition={{ duration: 0.22, ease: [0.165, 0.84, 0.44, 1] }}
                    className="flex min-w-0 items-center gap-2 overflow-hidden"
                  >
                    <label
                      htmlFor="default-domain"
                      className="font-sans text-detail-s whitespace-nowrap text-ink-secondary"
                    >
                      {dict.converter.defaultDomain}
                    </label>
                    <input
                      id="default-domain"
                      type="text"
                      value={defaultDomain}
                      onChange={(e) => setDefaultDomain(e.target.value)}
                      placeholder={dict.converter.defaultDomainPlaceholder}
                      spellCheck={false}
                      autoComplete="off"
                      className={cn(
                        'h-10 w-44 rounded-main border border-line bg-bg px-3',
                        'font-mono text-detail-s text-ink placeholder:text-ink-faint',
                        'transition-colors duration-200 ease-ant',
                        'focus:border-clay focus:outline-none',
                      )}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                variant="primary"
                size="md"
                onClick={handleConvert}
                disabled={!hasInput}
                className="min-w-[9rem]"
              >
                {ctaLabel}
              </Button>
            </div>
          </div>

          {needsDomain && hasInput && (
            <p className="px-4 pb-2 font-sans text-detail-xs text-ink-faint">
              {dict.converter.defaultDomainHint}
            </p>
          )}
        </div>

        <div className="px-4 pb-4">
          <IssueList issues={hasInput ? issues : []} dict={dict} />
          <StatsBar
            stats={result.stats}
            visible={revealed && result.ok && !isBatch}
            locale={locale}
            dict={dict}
          />
        </div>
      </div>
    </div>
  )
}
