function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-ok" fill="none" aria-hidden>
      <path
        d="M5 7V5.4a3 3 0 1 1 6 0V7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <rect x="3.2" y="7" width="9.6" height="6.2" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-ink-faint" fill="none" aria-hidden>
      <path
        d="M3 8h10M10 5l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TrustRow({ encrypt, send }: { encrypt: string; send: string }) {
  return (
    <ul className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-x-5">
      <li className="inline-flex items-center gap-2 font-sans text-detail-s text-ink-secondary">
        <LockIcon />
        {encrypt}
      </li>
      <li className="inline-flex items-center gap-2 font-sans text-detail-s text-ink-secondary">
        <SendIcon />
        {send}
      </li>
    </ul>
  )
}
