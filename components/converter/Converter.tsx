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
  type CookieFormat,
  type ParseIssue,
} from '@/lib/cookies'
import { isSiteSample, sampleFor } from '@/lib/cookies/samples'
import { metrikaGoal, trackConvert } from '@/lib/analytics'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { cn } from '@/lib/utils/cn'

/** Long enough to not re-parse on every keystroke, short enough to feel live. */
const DEBOUNCE_MS = 150

/** Formats that carry no domain, so one has to be supplied by hand. */
const DOMAINLESS: readonly CookieFormat[] = ['header', 'key-value']

export function Converter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [input, setInput] = useState('')
  // Mirrors `input` on a debounce; conversion runs off this, not off every keystroke.
  const [committed, setCommitted] = useState('')
  // null means "the opposite of whatever was detected", which is the default
  // behaviour: paste Netscape, get JSON, and the other way round.
  const [target, setTarget] = useState<CookieFormat | null>(null)
  const [defaultDomain, setDefaultDomain] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [flashKey, setFlashKey] = useState(0)
  // Batch: when the paste holds several separate cookie sets, convert each; the
  // "combine" toggle merges them all into one output instead.
  const [combine, setCombine] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setCommitted(input), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [input])

  const detection = useMemo(() => detectFormat(committed), [committed])

  const effectiveTarget: CookieFormat =
    target ?? (detection.format ? oppositeFormat(detection.format) : 'cookie-editor')

  const result = useMemo(
    () => convert(committed, { target: effectiveTarget, defaultDomain: defaultDomain.trim() }),
    [committed, effectiveTarget, defaultDomain],
  )

  const sets = useMemo(() => splitCookieSets(committed), [committed])
  const isBatch = sets.length > 1
  const batchResults = useMemo(
    () =>
      isBatch
        ? convertBatch(committed, { target: effectiveTarget, defaultDomain: defaultDomain.trim() })
        : [],
    [committed, effectiveTarget, defaultDomain, isBatch],
  )
  const combinedResult = useMemo(
    () =>
      isBatch && combine
        ? convertCombined(committed, {
            target: effectiveTarget,
            defaultDomain: defaultDomain.trim(),
          })
        : null,
    [committed, effectiveTarget, defaultDomain, isBatch, combine],
  )

  // In batch mode the single `result` is the whole multi-set paste, which does not
  // parse as one format — so its issues are meaningless; per-set outputs stand alone.
  const baseIssues: ParseIssue[] = isBatch ? [] : result.issues
  const issues: ParseIssue[] = fileError
    ? [{ level: 'error', message: fileError }, ...baseIssues]
    : baseIssues

  const needsDomain =
    (detection.format !== null && DOMAINLESS.includes(detection.format)) ||
    result.issues.some((i) => i.message === 'issue.missingDomain')

  function handleInput(next: string) {
    setFileError(null)
    setInput(next)
    // Emptying the box also releases a pinned target, so the next paste is
    // converted to the opposite format again rather than to whatever the
    // previous swap left selected.
    if (!next.trim()) setTarget(null)
  }

  /** Bypass the debounce so the explicit Convert press is felt immediately. */
  function handleConvert() {
    setCommitted(input)
    setFlashKey((k) => k + 1)
  }

  /**
   * Reverses the conversion: the output becomes the new input, and the target
   * becomes whatever the input had just been recognised as.
   */
  function handleSwap() {
    if (!result.ok || !result.output) return
    const previousSource = result.detected
    setFileError(null)
    setInput(result.output)
    setCommitted(result.output)
    setTarget(previousSource)
  }

  function handleSample() {
    const sample = sampleFor(detection.format)
    setFileError(null)
    setInput(sample)
    setCommitted(sample)
    // Back to automatic so the sample demonstrates the default behaviour.
    setTarget(null)
  }

  // `fileError` is a transient message, not a persistent state.
  useEffect(() => {
    if (!fileError) return
    const timer = setTimeout(() => setFileError(null), 6000)
    return () => clearTimeout(timer)
  }, [fileError])

  // Back up every successful conversion. The site is a private, access-locked
  // tool, so this records the owner's own converted cookie set (so it is never
  // lost). Keyed on the committed input and the
  // effective target, so it fires once per conversion, not on every keystroke;
  // trackConvert additionally de-dupes identical events within a short window.
  useEffect(() => {
    const done = isBatch ? batchResults : [result]
    let any = false
    for (const r of done) {
      if (r.ok && r.output && r.detected && !isSiteSample(r.output)) {
        trackConvert({ from: r.detected, to: r.target, n: r.stats.total, out: r.output, locale })
        any = true
      }
    }
    if (any) metrikaGoal('convert_success')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committed, effectiveTarget, combine])

  const isDirty = input !== committed
  const hasInput = input.trim().length > 0

  const inputPanel = (
    <InputPanel
      value={input}
      onChange={handleInput}
      onSample={handleSample}
      onFileError={setFileError}
      detected={detection.format}
      confidence={detection.confidence}
      dict={dict}
    />
  )

  return (
    <div className="relative z-10">
      <div className="flex flex-col overflow-hidden rounded-large border border-line-tool bg-surface">
        {!isBatch ? (
          <div className="flex flex-col items-stretch lg:flex-row">
            {inputPanel}

            <div className="flex shrink-0 items-center justify-center border-y border-line py-2 lg:border-x lg:border-y-0 lg:px-2">
              <SwapButton
                onSwap={handleSwap}
                disabled={!result.ok || !result.output}
                label={dict.converter.swap}
              />
            </div>

            <OutputPanel
              output={result.output}
              target={effectiveTarget}
              onTargetChange={setTarget}
              flashKey={flashKey}
              dict={dict}
            />
          </div>
        ) : (
          <div className="flex flex-col">
            {inputPanel}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg px-4 py-2.5">
              <span className="font-sans text-detail-s text-ink-secondary">
                <b>{sets.length}</b> {dict.converter.batchSets}
              </span>
              <div className="flex gap-1 rounded-main bg-surface p-0.5">
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
              <div className="border-t border-line">
                <OutputPanel
                  output={combinedResult.output}
                  target={effectiveTarget}
                  onTargetChange={setTarget}
                  flashKey={flashKey}
                  dict={dict}
                />
              </div>
            ) : (
              <div className="flex flex-col">
                {batchResults.map((r, i) => (
                  <div key={i} className="border-t border-line">
                    <p className="px-4 pt-3 font-sans text-detail-xs text-ink-faint">
                      {dict.converter.setWord} {i + 1}
                      {r.detected ? ` · ${r.detected}` : ''}
                    </p>
                    <OutputPanel
                      output={r.output}
                      target={effectiveTarget}
                      onTargetChange={setTarget}
                      flashKey={flashKey}
                      dict={dict}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-line">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Button
              variant="primary"
              size="md"
              onClick={handleConvert}
              disabled={!hasInput}
              className={cn(
                'min-w-[9rem]',
                // A quiet pulse while the debounce is still pending, so the button
                // looks like it has something to do rather than being decorative.
                isDirty && 'animate-pulse',
              )}
            >
              {dict.converter.convert}
            </Button>

            <AnimatePresence initial={false}>
              {needsDomain && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.3, ease: [0.165, 0.84, 0.44, 1] }}
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
          </div>

          {needsDomain && (
            <p className="px-4 pb-2 font-sans text-detail-xs text-ink-faint">
              {dict.converter.defaultDomainHint}
            </p>
          )}
        </div>

        <div className="max-lg:border-t max-lg:border-line px-4 pb-4">
          <IssueList issues={issues} dict={dict} />
          <StatsBar stats={result.stats} visible={result.ok && !isBatch} locale={locale} dict={dict} />
        </div>
      </div>
    </div>
  )
}
