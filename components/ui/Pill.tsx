import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface PillProps {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'error' | 'muted'
  className?: string
}

const TONES = {
  neutral: 'bg-surface text-ink border-line',
  accent: 'bg-clay/12 text-clay border-clay/30',
  ok: 'bg-ok/12 text-ok border-ok/30',
  warn: 'bg-warn/15 text-warn border-warn/35',
  error: 'bg-error/12 text-error border-error/30',
  muted: 'bg-bg-secondary text-ink-faint border-line',
} as const

/** Small status chip: detected format, stat counters, table flags. */
export function Pill({ children, tone = 'neutral', className }: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-round border px-2.5 py-1',
        'font-sans text-detail-xs font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
