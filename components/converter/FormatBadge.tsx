'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import type { CookieFormat } from '@/lib/cookies'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { plural } from '@/lib/i18n/plural'
import { cn } from '@/lib/utils/cn'

interface FormatBadgeProps {
  format: CookieFormat | null
  /** Below ~0.8 the detection was a guess rather than a certainty. */
  confidence: number
  hasInput: boolean
  cookieCount: number
  locale: Locale
  dict: Dictionary
}

/**
 * Inline detection chrome. A pill here would look like generic SaaS; the
 * sequence Waiting → Detecting → "{format} detected · N cookies" is the
 * product-specific tell.
 */
export function FormatBadge({
  format,
  confidence,
  hasInput,
  cookieCount,
  locale,
  dict,
}: FormatBadgeProps) {
  const [phase, setPhase] = useState<'idle' | 'detecting' | 'done'>('idle')

  useEffect(() => {
    if (!hasInput) {
      setPhase('idle')
      return
    }
    setPhase('detecting')
    const timer = setTimeout(() => setPhase('done'), 250)
    return () => clearTimeout(timer)
  }, [hasInput, format])

  const isGuess = Boolean(format) && confidence < 0.8
  const formatLabel = format ? dict.formats[format].label : ''
  const countBit =
    cookieCount > 0 ? ` · ${cookieCount} ${plural(locale, cookieCount, dict.stats.cookies)}` : ''

  let label = dict.converter.awaiting
  if (hasInput && phase === 'detecting') label = dict.converter.detecting
  else if (hasInput && !format) label = dict.converter.unknown
  else if (hasInput && format) {
    label = isGuess
      ? `${formatLabel} · ${dict.converter.detectedGuess}${countBit}`
      : `${formatLabel}${countBit}`
  }

  const state = !hasInput ? 'idle' : phase === 'detecting' ? 'detecting' : format ? 'found' : 'unknown'

  return (
    <div className="flex min-w-0 items-center">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={`${state}-${format ?? ''}-${isGuess}-${cookieCount}`}
          initial={{ y: 4 }}
          animate={{ y: 0 }}
          exit={{ y: -4 }}
          transition={{ duration: 0.22, ease: [0.165, 0.84, 0.44, 1] }}
          className={cn(
            'inline-flex min-w-0 items-center gap-1.5 font-sans text-detail-xs whitespace-nowrap',
            state === 'idle' && 'text-ink-faint',
            state === 'detecting' && 'text-ink-secondary',
            state === 'unknown' && 'text-error',
            state === 'found' && !isGuess && 'text-ink-secondary',
            state === 'found' && isGuess && 'text-warn',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'size-1.5 shrink-0 rounded-round',
              state === 'idle' && 'bg-ink-faint/70',
              state === 'detecting' && 'bg-ink-secondary',
              state === 'unknown' && 'bg-error',
              state === 'found' && !isGuess && 'bg-ok',
              state === 'found' && isGuess && 'bg-warn',
            )}
          />
          {label}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}
