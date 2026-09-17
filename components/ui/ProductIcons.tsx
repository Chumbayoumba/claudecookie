import { cn } from '@/lib/utils/cn'

interface IconProps {
  className?: string
}

/** Swap arrows — the converter. */
export function ProductIconConverter({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-5', className)}
      fill="none"
      aria-hidden
    >
      <path
        d="M7 7h10l-3-3M17 17H7l3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Check mark in a circle — session checker. */
export function ProductIconCheck({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-5', className)}
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="m8.2 12.2 2.5 2.5 5.1-5.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** File with a key cut — credential file. */
export function ProductIconCredential({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('size-5', className)}
      fill="none"
      aria-hidden
    >
      <path
        d="M7 3.75h6.2L17.25 8v12.25H7z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M13.2 3.75V8h4.05"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="10.2" cy="14.2" r="1.55" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M11.6 14.2h3.4V16"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
