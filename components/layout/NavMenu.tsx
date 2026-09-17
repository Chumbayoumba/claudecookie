'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils/cn'

interface NavMenuProps {
  label: string
  items: { href: string; label: string }[]
}

export function NavMenu({ label, items }: NavMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-1.5',
          'font-sans text-detail-s font-medium text-ink-secondary',
          'transition-colors duration-200 ease-ant hover:text-ink',
          open && 'text-ink',
        )}
      >
        {label}
        <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden>
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div className="absolute top-full left-0 z-50 mt-1.5 min-w-52 rounded-main border border-line bg-surface p-1">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block rounded-main px-3 py-2 font-sans text-detail-s text-ink-secondary transition-colors duration-200 ease-ant hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  )
}
