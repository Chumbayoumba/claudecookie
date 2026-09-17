import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

interface ToolShellProps {
  children: ReactNode
  className?: string
}

/** Plain tool wrapper. No glow. */
export function ToolShell({ children, className }: ToolShellProps) {
  return (
    <div className={cn('ant-tool', className)}>
      {children}
    </div>
  )
}
