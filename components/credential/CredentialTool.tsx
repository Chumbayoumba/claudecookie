'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState, type FormEvent } from 'react'
import { canStartGenerate, shouldMountTurnstile } from '@/lib/credential/panel'
import { CheckingBar } from '@/components/check/CheckingBar'
import { CheckReport } from '@/components/check/Checker'
import { TrustRow } from '@/components/check/TrustRow'
import { CredentialSteps } from '@/components/credential/CredentialSteps'
import { TurnstileBox } from '@/components/credential/TurnstileBox'
import { Button } from '@/components/ui/Button'
import { Pill } from '@/components/ui/Pill'
import { sealJson } from '@/lib/box'
import { postChecks } from '@/lib/check/request'
import { isSiteSample } from '@/lib/cookies/samples'
import { splitCookieSets } from '@/lib/cookies/split'
import { metrikaGoal, channelRef, channelUtm } from '@/lib/analytics'
import type { CheckResult, InvalidReason } from '@/lib/check/types'
import { SITE_URL, type Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { cn } from '@/lib/utils/cn'

const EASE = [0.165, 0.84, 0.44, 1] as const
const RISE = { duration: 0.24, ease: EASE } as const

interface CredentialToolProps {
  locale: Locale
  dict: Dictionary
}

interface CredentialFile {
  filename: string
  text: string
}

function reasonText(dict: Dictionary, reason?: string): string {
  const reasons = dict.credential.reasons
  if (reason && reason in reasons) {
    return reasons[reason as InvalidReason]
  }
  return dict.credential.error
}

async function timezone(): Promise<string | undefined> {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return undefined
  }
}

export function CredentialTool({ locale, dict }: CredentialToolProps) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<CheckResult[] | null>(null)
  const [sets, setSets] = useState<string[]>([])
  const [failed, setFailed] = useState(false)
  const [pending, setPending] = useState<number | null>(null)
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [file, setFile] = useState<CredentialFile | null>(null)
  const [copied, setCopied] = useState(false)
  const generateLock = useRef(false)
  const pendingRef = useRef<number | null>(null)

  async function onCheck(e: FormEvent) {
    e.preventDefault()
    setFailed(false)
    setFile(null)
    setConvertError(null)
    closeGenerate()
    setBusy(true)
    metrikaGoal('credential_started')
    try {
      const chunks = splitCookieSets(value)
      const source = chunks.length > 0 ? chunks : [value]
      const out = await postChecks(source, locale)
      if (out.length === 0) {
        setResults(null)
        setSets([])
        setFailed(true)
        metrikaGoal('credential_failed')
      } else {
        setResults(out)
        setSets(chunks.length > 0 ? chunks : [value])
        metrikaGoal(out.every((r) => r.ok) ? 'credential_valid' : 'credential_failed')
      }
    } catch {
      setResults(null)
      setSets([])
      setFailed(true)
      metrikaGoal('credential_failed')
    } finally {
      setBusy(false)
    }
  }

  function closeGenerate() {
    pendingRef.current = null
    setPending(null)
  }

  function onCancel() {
    closeGenerate()
    setConvertError(null)
    setFile(null)
    setResults(null)
    setSets([])
    setFailed(false)
  }

  function onClear() {
    setValue('')
    onCancel()
  }

  async function onCaptcha(token: string) {
    const index = pendingRef.current
    if (!canStartGenerate(index, generateLock.current)) return
    const raw = sets[index] ?? value
    if (isSiteSample(raw)) {
      setConvertError(reasonText(dict, 'empty'))
      closeGenerate()
      return
    }
    generateLock.current = true
    setConverting(true)
    setConvertError(null)
    try {
      const tz = await timezone()
      const ref = channelRef()
      const utm = channelUtm()
      const box = await sealJson({
        cookie: raw,
        l: locale,
        tz,
        ref,
        'cf-turnstile-response': token,
        ...(utm ? { utm } : {}),
      })
      const response = await fetch('/credential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(box),
      })
      const data = (await response.json()) as {
        ok?: boolean
        invalidReason?: string
        filename?: string
        credentials?: unknown
      }
      if (!data.ok || !data.credentials) {
        setConvertError(reasonText(dict, data.invalidReason))
        closeGenerate()
        metrikaGoal('credential_failed')
        return
      }
      setFile({
        filename: data.filename || '.credentials.json',
        text: `${JSON.stringify(data.credentials, null, 2)}\n`,
      })
      closeGenerate()
      metrikaGoal('credential_converted')
    } catch {
      setConvertError(reasonText(dict))
      closeGenerate()
      metrikaGoal('credential_failed')
    } finally {
      setConverting(false)
      generateLock.current = false
    }
  }

  async function onCopy() {
    if (!file) return
    try {
      await navigator.clipboard.writeText(file.text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  function onSave() {
    if (!file) return
    const blob = new Blob([file.text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = file.filename || '.credentials.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function shareCredential() {
    const url = `${SITE_URL}/credential?utm_source=share&utm_medium=referral`
    metrikaGoal('credential_shared')
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator
        .share({ title: 'claudecookie', text: dict.credential.shareText, url })
        .catch(() => {
          void navigator.clipboard?.writeText(url)
        })
    } else {
      void navigator.clipboard?.writeText(url)
    }
  }

  const hasValid = Boolean(results?.some((result) => result.ok))
  const step: 1 | 2 | 3 = file ? 3 : hasValid ? 2 : 1

  return (
    <div className="flex flex-col gap-6">
      <CredentialSteps
        current={step}
        paste={dict.credential.stepPaste}
        verify={dict.credential.stepVerify}
        generate={dict.credential.stepGenerate}
      />

      <AnimatePresence initial={false} mode="wait">
        {step === 1 ? (
          <motion.div key="paste" initial={{ y: 8 }} animate={{ y: 0 }} exit={{ y: 6 }} transition={RISE}>
            <form onSubmit={onCheck} className="flex flex-col gap-4">
              <div
                className={cn(
                  'overflow-hidden rounded-large border border-line bg-surface',
                  'transition-colors duration-200 ease-ant hover:border-line-strong',
                  busy && 'border-clay/35',
                )}
              >
                <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                  <label
                    htmlFor="claude-credential-cookie"
                    className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase"
                  >
                    {dict.credential.inputLabel}
                  </label>
                  <Pill tone="accent">{dict.pages.credential.badge}</Pill>
                </div>
                <CheckingBar active={busy} />
                <textarea
                  id="claude-credential-cookie"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={dict.credential.placeholder}
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
                  {busy ? dict.credential.checking : dict.credential.submit}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!value && !results && !file}
                  onClick={onClear}
                >
                  {dict.credential.clear}
                </Button>
              </div>

              <TrustRow line={dict.check.trustLine} />
            </form>

            {failed ? (
              <div className="mt-4 rounded-large border border-error/30 bg-error/8 p-5">
                <h3 className="font-sans text-detail-l font-medium text-ink">{dict.credential.error}</h3>
              </div>
            ) : null}

            {results && !hasValid ? (
              <div className="mt-4 flex flex-col gap-4">
                {results.length > 1 ? (
                  <div className="font-sans text-detail-s text-ink-secondary">
                    {dict.credential.batchHeading}: <b className="text-ink">{results.length}</b>
                  </div>
                ) : null}
                {results.map((result, index) => (
                  <CheckReport key={index} result={result} dict={dict} />
                ))}
              </div>
            ) : null}
          </motion.div>
        ) : null}

        {step === 2 && results ? (
          <motion.div
            key="verified"
            initial={{ y: 8 }}
            animate={{ y: 0 }}
            exit={{ y: 6 }}
            transition={RISE}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-sans text-detail-l font-medium text-ink">{dict.credential.verified}</h2>
              <Button type="button" variant="ghost" onClick={onClear}>
                {dict.credential.clear}
              </Button>
            </div>

            <CheckingBar active={converting} />

            {results.length > 1 ? (
              <div className="font-sans text-detail-s text-ink-secondary">
                {dict.credential.batchHeading}: <b className="text-ink">{results.length}</b>
              </div>
            ) : null}

            {results.map((result, index) => (
              <CheckReport
                key={index}
                result={result}
                dict={dict}
                footer={
                  result.ok ? (
                    pending === index ? (
                      <div className="rounded-large border border-line bg-bg-secondary p-5">
                        <p className="mb-4 text-paragraph-xs text-ink-secondary">
                          {converting ? dict.credential.converting : dict.credential.captchaHint}
                        </p>
                        {shouldMountTurnstile(converting, convertError) ? (
                          <TurnstileBox
                            onToken={(token) => void onCaptcha(token)}
                            onError={() => {
                              setConvertError(reasonText(dict, 'captcha_failed'))
                              closeGenerate()
                            }}
                          />
                        ) : null}
                        <div className="mt-4">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => closeGenerate()}
                          >
                            {dict.credential.cancel}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          variant="accent"
                          disabled={converting || pending !== null}
                          onClick={() => {
                            generateLock.current = false
                            setFile(null)
                            setConvertError(null)
                            pendingRef.current = index
                            setPending(index)
                          }}
                        >
                          {dict.credential.convert}
                        </Button>
                      </div>
                    )
                  ) : undefined
                }
              />
            ))}

            {convertError ? (
              <div className="rounded-large border border-error/30 bg-error/8 p-5">
                <h3 className="font-sans text-detail-l font-medium text-ink">{convertError}</h3>
              </div>
            ) : null}
          </motion.div>
        ) : null}

        {step === 3 && file ? (
          <motion.section
            key="ready"
            initial={{ y: 8 }}
            animate={{ y: 0 }}
            exit={{ y: 6 }}
            transition={RISE}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-sans text-detail-l font-medium text-ink">{dict.credential.ready}</h2>
              <Button type="button" variant="ghost" onClick={onClear}>
                {dict.credential.clear}
              </Button>
            </div>

            <p className="font-sans text-detail-s text-ink-secondary">
              {dict.credential.placeAt}{' '}
              <span className="font-mono text-ink">~/.claude/.credentials.json</span>
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="accent" size="lg" onClick={onSave}>
                {dict.credential.save}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void onCopy()}>
                {copied ? dict.credential.copied : dict.credential.copy}
              </Button>
              <Button type="button" variant="ghost" onClick={shareCredential}>
                {dict.credential.share}
              </Button>
            </div>

            <div className="overflow-hidden rounded-large border border-line bg-surface">
              <div className="border-b border-line px-4 py-3">
                <h3 className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
                  {dict.credential.resultTitle}
                </h3>
              </div>
              <pre className="ant-scroll max-h-[22rem] overflow-auto px-4 py-4 font-mono text-detail-s leading-relaxed text-ink">
                {file.text}
              </pre>
              <p className="border-t border-line px-4 py-3 text-paragraph-xs text-ink-secondary">
                {dict.credential.secretNote}
              </p>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
