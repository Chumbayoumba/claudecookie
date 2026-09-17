'use client'

import { AnimatePresence, motion } from 'motion/react'
import type { CookieFormat } from '@/lib/cookies'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { cn } from '@/lib/utils/cn'

interface FormatBadgeProps {
  format: CookieFormat | null
  /** Below ~0.8 the detection was a guess rather than a certainty. */
  confidence: number
  hasInput: boolean
  dict: Dictionary
}

/**
 * Shows which format the input was recognised as.
 *
 * The label crossfades whenever the detection changes, which is the main signal
 * that the tool is reacting to what you paste.
 */
export function FormatBadge({ format, confidence, hasInput, dict }: FormatBadgeProps) {
  const state = !hasInput ? 'idle' : format ? 'found' : 'unknown'
  const isGuess = state === 'found' && confidence < 0.8

  const label =
    state === 'idle'
      ? dict.converter.awaiting
      : state === 'unknown'
        ? dict.converter.unknown
        : `${isGuess ? dict.converter.detectedGuess : dict.converter.detected}: ${
            dict.formats[format as CookieFormat].label
          }`

  return (
    <div className="flex h-7 items-center">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={`${state}-${format ?? ''}-${isGuess}`}
          initial={{ opacity: 0, y: 4, rotate: -3 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: [0.165, 0.84, 0.44, 1] }}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-round border px-2.5 py-1',
            'font-sans text-detail-xs font-medium whitespace-nowrap',
            state === 'idle' && 'border-line bg-bg-secondary text-ink-faint',
            state === 'unknown' && 'border-error/30 bg-error/10 text-error',
            state === 'found' && !isGuess && 'border-ok/30 bg-ok/12 text-ok',
            state === 'found' && isGuess && 'border-warn/35 bg-warn/15 text-warn',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'size-1.5 rounded-round',
              state === 'idle' && 'bg-ink-faint',
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
