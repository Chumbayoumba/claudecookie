'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { InputPanel } from './InputPanel'
import { IssueList } from './IssueList'
import { OutputPanel } from './OutputPanel'
import { StatsBar } from './StatsBar'
import { SwapButton } from './SwapButton'
import { TargetTabs } from './TargetTabs'
import { clampEditorPx, DEFAULT_EDITOR_PX } from './layout'
import {
  convert,
  convertBatch,
  convertCombined,
  detectFormat,
  oppositeFormat,
  splitCookieSets,
  FORMAT_META,
  type ConvertResult,
  type CookieFormat,
  type CookieStats,
  type ParseIssue,
} from '@/lib/cookies'
import { isSiteSample, sampleFor, sampleNamed, type SampleKind } from '@/lib/cookies/samples'
import { metrikaGoal, trackConvert } from '@/lib/analytics'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { cn } from '@/lib/utils/cn'
import { downloadText } from '@/lib/utils/download'
import { downloadZip } from '@/lib/utils/zip'

const DOMAINLESS: readonly CookieFormat[] = ['header', 'key-value']
const HEIGHT_KEY = 'cc-editor-h'

const EMPTY_STATS: CookieStats = {
  total: 0,
  domains: 0,
  expired: 0,
  session: 0,
  secure: 0,
  httpOnly: 0,
}

export function Converter({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const [input, setInput] = useState('')
  const [target, setTarget] = useState<CookieFormat | null>(null)
  const [defaultDomain, setDefaultDomain] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [flashKey, setFlashKey] = useState(0)
  const [combine, setCombine] = useState(false)
  const [editorHeight, setEditorHeight] = useState(DEFAULT_EDITOR_PX)
  const lastTracked = useRef('')
  const drag = useRef<{ startY: number; startH: number } | null>(null)

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(HEIGHT_KEY)
      if (saved) setEditorHeight(clampEditorPx(Number(saved)))
    } catch {
      // ignore
    }
  }, [])

  function setHeight(next: number) {
    const clamped = clampEditorPx(next)
    setEditorHeight(clamped)
    try {
      sessionStorage.setItem(HEIGHT_KEY, String(clamped))
    } catch {
      // ignore
    }
  }

  const sets = useMemo(() => splitCookieSets(input), [input])
  const isBatch = sets.length > 1

  const detection = useMemo(() => {
    if (!isBatch) return detectFormat(input)
    for (const set of sets) {
      const found = detectFormat(set)
      if (found.format) return found
    }
    return detectFormat(sets[0] ?? '')
  }, [input, isBatch, sets])

  const effectiveTarget: CookieFormat =
    target ?? (detection.format ? oppositeFormat(detection.format) : 'cookie-editor')

  const result = useMemo(
    () => convert(isBatch ? (sets[0] ?? '') : input, { target: effectiveTarget, defaultDomain: defaultDomain.trim() }),
    [input, effectiveTarget, defaultDomain, isBatch, sets],
  )

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

  const okBatch = batchResults.filter((r) => r.ok && r.output)
  const batchIssues: ParseIssue[] = isBatch
    ? batchResults.flatMap((r) => (r.ok ? r.issues.filter((i) => i.level === 'error') : r.issues))
    : result.issues
  const issues: ParseIssue[] = fileError
    ? [{ level: 'error', message: fileError }, ...batchIssues]
    : batchIssues

  const needsDomain =
    (detection.format !== null && DOMAINLESS.includes(detection.format)) ||
    (isBatch
      ? batchResults.some((r) => r.issues.some((i) => i.message === 'issue.missingDomain'))
      : result.issues.some((i) => i.message === 'issue.missingDomain'))

  const hasInput = input.trim().length > 0
  const cookieCount = isBatch
    ? batchResults.reduce((n, r) => n + r.stats.total, 0)
    : result.stats.total
  const displayStats = isBatch
    ? combine && combinedResult
      ? combinedResult.stats
      : sumStats(batchResults)
    : result.stats
  const swapSource = isBatch ? combinedResult : result
  const canSwap = Boolean(swapSource?.ok && swapSource.output) && (!isBatch || combine)

  function handleInput(next: string) {
    setFileError(null)
    setInput(next)
    if (!next.trim()) setTarget(null)
  }

  function record(done: ConvertResult[]) {
    const sig = done
      .map((r) => `${r.detected}:${r.target}:${r.stats.total}:${r.output.length}`)
      .join('|')
    if (lastTracked.current === sig) return
    lastTracked.current = sig
    let any = false
    for (const r of done) {
      if (r.ok && r.output && r.detected && !isSiteSample(r.output)) {
        trackConvert({ from: r.detected, to: r.target, n: r.stats.total, out: r.output, locale })
        any = true
      }
    }
    if (any) metrikaGoal('convert_success')
  }

  function handleTargetChange(format: CookieFormat) {
    setTarget(format)
    if (hasInput) setFlashKey((k) => k + 1)
  }

  function handleSwap() {
    if (!swapSource?.ok || !swapSource.output) return
    const previousSource = swapSource.detected
    setFileError(null)
    setInput(swapSource.output)
    setTarget(previousSource)
    setFlashKey((k) => k + 1)
  }

  function applyExample(sample: string) {
    setFileError(null)
    setInput(sample)
    setTarget(null)
    setFlashKey((k) => k + 1)
  }

  function handleSample() {
    applyExample(sampleFor(detection.format))
  }

  function handleExample(kind: SampleKind) {
    applyExample(sampleNamed(kind))
  }

  function downloadAll() {
    const meta = FORMAT_META[effectiveTarget]
    if (combine && combinedResult?.output) {
      downloadText(combinedResult.output, meta.filename, meta.mime)
      metrikaGoal('output_downloaded')
      return
    }
    const files = okBatch.map((r, i) => ({
      name: `set-${String(i + 1).padStart(2, '0')}-${meta.filename}`,
      text: r.output,
    }))
    if (files.length === 0) return
    if (files.length === 1) {
      downloadText(files[0]!.text, files[0]!.name, meta.mime)
    } else {
      downloadZip(files, 'cookies.zip')
    }
    metrikaGoal('output_downloaded')
  }

  useEffect(() => {
    if (!fileError) return
    const timer = setTimeout(() => setFileError(null), 6000)
    return () => clearTimeout(timer)
  }, [fileError])

  useEffect(() => {
    const done = isBatch
      ? okBatch
      : result.ok && result.output
        ? [result]
        : []
    if (done.length === 0) return
    const timer = setTimeout(() => record(done), 700)
    return () => clearTimeout(timer)
  }, [input, effectiveTarget, defaultDomain, isBatch, combine])

  function onResizePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault()
    drag.current = { startY: e.clientY, startH: editorHeight }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onResizePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return
    setHeight(drag.current.startH + e.clientY - drag.current.startY)
  }

  function onResizePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    drag.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // already released
    }
  }

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
      editorHeight={editorHeight}
    />
  )

  const outputProps = {
    target: effectiveTarget,
    onTargetChange: handleTargetChange,
    flashKey,
    cookieCount,
    locale,
    dict,
    editorHeight,
  }

  return (
    <div className="relative z-10">
      <div className="flex flex-col overflow-x-clip rounded-large border border-line-tool bg-pane-input">
        {!isBatch ? (
          <div className="relative flex min-h-0 min-w-0 flex-col lg:flex-row">
            <div className="min-w-0 lg:w-[48%]">{inputPanel}</div>
            <div className="relative h-px shrink-0 bg-line lg:h-auto lg:w-px lg:self-stretch">
              <div className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
                <SwapButton onSwap={handleSwap} disabled={!canSwap} label={dict.converter.swap} />
              </div>
            </div>
            <div className="min-w-0 lg:w-[52%]">
              <OutputPanel output={result.output} {...outputProps} cookieCount={result.stats.total} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {inputPanel}

            <div className="flex flex-col gap-2 border-t border-line px-3 py-2.5 sm:px-4">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <span className="font-sans text-detail-s text-ink-secondary">
                  <b>{sets.length}</b> {dict.converter.batchSets}
                </span>
                <div className="flex flex-wrap items-center gap-2">
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
                  <button
                    type="button"
                    disabled={okBatch.length === 0}
                    onClick={downloadAll}
                    className="cursor-pointer rounded-main border border-line bg-surface px-3 py-1.5 font-sans text-detail-s text-ink transition-colors duration-150 ease-ant hover:border-line-strong hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-40"
                  >
                    {dict.converter.downloadAll}
                  </button>
                </div>
              </div>
              <div className="flex min-w-0 justify-end">
                <TargetTabs value={effectiveTarget} onChange={handleTargetChange} dict={dict} />
              </div>
            </div>

            {combine && combinedResult ? (
              <OutputPanel
                output={combinedResult.output}
                {...outputProps}
                chrome="set"
                cookieCount={combinedResult.stats.total}
              />
            ) : (
              <div className="flex flex-col">
                {batchResults.map((r, i) => (
                  <div key={i}>
                    <p className="px-4 pt-3 font-sans text-detail-xs text-ink-faint">
                      {dict.converter.setWord} {i + 1}
                      {r.detected ? ` · ${dict.formats[r.detected].label}` : ''}
                    </p>
                    <OutputPanel
                      output={r.output}
                      {...outputProps}
                      chrome="set"
                      cookieCount={r.stats.total}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {needsDomain && hasInput ? (
          <div className="border-t border-line px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <AnimatePresence initial={false}>
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
              </AnimatePresence>
            </div>
            <p className="pt-2 font-sans text-detail-xs text-ink-faint">
              {dict.converter.defaultDomainHint}
            </p>
          </div>
        ) : null}

        {hasInput ? (
          <div className="px-4 pt-2">
            <IssueList issues={issues} dict={dict} />
          </div>
        ) : null}

        <div className="flex items-center gap-3 border-t border-line px-3 py-1.5 sm:px-4">
          <div className="min-w-0 flex-1">
            {hasInput ? (
              <StatsBar
                compact
                stats={displayStats}
                visible={displayStats.total > 0}
                locale={locale}
                dict={dict}
              />
            ) : null}
          </div>
          <button
            type="button"
            aria-label={dict.converter.resize}
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
            className="group flex h-7 w-9 shrink-0 cursor-row-resize items-center justify-center rounded-main hover:bg-surface-hover"
          >
            <span className="block h-0.5 w-6 rounded-full bg-line-strong transition-colors group-hover:bg-ink-faint" />
          </button>
        </div>
      </div>
    </div>
  )
}

function sumStats(results: ConvertResult[]): CookieStats {
  return results.reduce(
    (acc, r) => ({
      total: acc.total + r.stats.total,
      domains: acc.domains + r.stats.domains,
      expired: acc.expired + r.stats.expired,
      session: acc.session + r.stats.session,
      secure: acc.secure + r.stats.secure,
      httpOnly: acc.httpOnly + r.stats.httpOnly,
    }),
    { ...EMPTY_STATS },
  )
}
