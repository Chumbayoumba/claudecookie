'use client'

import { AnimatePresence, motion } from 'motion/react'
import type { CookieStats } from '@/lib/cookies'
import type { Locale } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { plural } from '@/lib/i18n/plural'
import { cn } from '@/lib/utils/cn'

interface StatsBarProps {
  stats: CookieStats
  visible: boolean
  locale: Locale
  dict: Dictionary
  /** One line beside the resize grip; no extra top padding. */
  compact?: boolean
}

/** Counters under the panels. Zero-valued entries are hidden to keep it quiet. */
export function StatsBar({ stats, visible, locale, dict, compact = false }: StatsBarProps) {
  const entries = (
    [
      { key: 'cookies', value: stats.total, tone: 'ink' },
      { key: 'domains', value: stats.domains, tone: 'ink' },
      { key: 'session', value: stats.session, tone: 'ink' },
      { key: 'expired', value: stats.expired, tone: 'warn' },
      { key: 'secure', value: stats.secure, tone: 'muted' },
      { key: 'httpOnly', value: stats.httpOnly, tone: 'muted' },
    ] as const
  )
    .filter((e) => e.value > 0)
    // "1 domains" is wrong in English and "4 кук" is wrong in Russian, so each
    // label carries its own plural forms rather than a single noun.
    .map((e) => ({ ...e, label: plural(locale, e.value, dict.stats[e.key]) }))

  const chips = (
    <div
      className={cn(
        'flex flex-wrap items-center font-sans text-detail-s',
        compact ? 'gap-x-4 gap-y-1' : 'gap-x-5 gap-y-2 pt-5',
      )}
    >
      {entries.map((entry) => (
        <span key={entry.key} className="flex items-baseline gap-1.5">
          <span
            className={cn(
              'font-mono text-detail-l font-medium tabular-nums',
              entry.tone === 'warn' ? 'text-warn' : 'text-ink',
            )}
          >
            {entry.value}
          </span>
          <span className="text-ink-faint">{entry.label}</span>
        </span>
      ))}
    </div>
  )

  if (compact) {
    if (!visible || entries.length === 0) return null
    return chips
  }

  return (
    <AnimatePresence initial={false}>
      {visible && entries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.28, ease: [0.165, 0.84, 0.44, 1] }}
          className="overflow-hidden"
        >
          {chips}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
