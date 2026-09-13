import { motion } from 'motion/react'
import type { UsageWindow } from '@/lib/check/types'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { cn } from '@/lib/utils/cn'

const EASE = [0.165, 0.84, 0.44, 1] as const

interface UsageCardProps {
  title: string
  window: UsageWindow | null | undefined
  dict: Dictionary
}

export function UsageCard({ title, window, dict }: UsageCardProps) {
  const percent = window?.percent
  const known = typeof percent === 'number'
  const width = known ? Math.min(100, Math.max(0, percent)) : 0
  const tone =
    !known ? 'bg-ink-faint' : percent >= 90 ? 'bg-error' : percent >= 70 ? 'bg-warn' : 'bg-ok'

  return (
    <article className="rounded-large border border-line bg-surface p-6">
      <h3 className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
        {title}
      </h3>
      <p className="mt-3 font-sans text-display-xs text-ink">
        {known ? (
          <>
            {percent}% {dict.check.used}
            {window?.resets ? (
              <span className="text-ink-secondary">
                {' '}
                · {dict.check.resets} {window.resets}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-ink-secondary">{dict.check.unknownWindow}</span>
        )}
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg-tertiary">
        <motion.div
          className={cn('h-full rounded-full', tone)}
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.55, ease: EASE }}
        />
      </div>
    </article>
  )
}
