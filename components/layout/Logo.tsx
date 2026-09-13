import { cn } from '@/lib/utils/cn'

/**
 * A cookie rendered in the brand clay: a filled disc with a bite taken out of
 * the top-right and three chips punched through it. Drawn with even-odd fill so
 * the chips are holes rather than stacked shapes, which keeps it legible at 20px.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('size-7 shrink-0', className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16 2c1.2 0 2.36.15 3.47.44a4.6 4.6 0 0 0 5.02 5.02A14 14 0 1 1 16 2Zm-4.9 7.3a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Zm8.4 5.6a2.1 2.1 0 1 0 0 4.2 2.1 2.1 0 0 0 0-4.2Zm-7 5.6a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Z"
      />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-sans text-detail-l font-semibold tracking-[-0.02em]', className)}>
      claude<span className="text-clay">cookie</span>
    </span>
  )
}
