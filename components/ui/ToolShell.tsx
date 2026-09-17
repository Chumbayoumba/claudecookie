import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface ToolShellProps {
  children: ReactNode
  className?: string
}

/** Soft glow behind the main tool card. No neon, no grid. */
export function ToolShell({ children, className }: ToolShellProps) {
  return (
    <div className={cn('relative', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-44 w-[min(36rem,90vw)] -translate-x-1/2 rounded-full bg-clay/10 blur-3xl"
      />
      {children}
    </div>
  )
}
