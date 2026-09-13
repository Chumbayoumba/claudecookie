import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'accent'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

/*
 * Anthropic's buttons animate colour only - no scale, no lift. Keeping to that
 * is most of what makes the UI feel like theirs rather than a generic SaaS page.
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-invert text-invert-ink hover:bg-invert-hover border border-transparent',
  secondary:
    'bg-surface text-ink border border-line hover:bg-surface-hover hover:border-line-strong',
  ghost:
    'bg-transparent text-ink-secondary border border-transparent hover:text-ink hover:bg-surface-hover',
  accent:
    'bg-clay text-clay-contrast hover:bg-clay-hover border border-transparent',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-detail-s gap-1.5 rounded-small',
  md: 'h-10 px-4 text-detail-m gap-2 rounded-main',
  lg: 'h-12 px-6 text-detail-l gap-2 rounded-main',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap',
        'transition-[background-color,border-color,color,opacity] duration-200 ease-ant',
        'disabled:pointer-events-none disabled:opacity-40',
        'cursor-pointer select-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
