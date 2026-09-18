'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CookieFormat } from '@/lib/cookies'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { cn } from '@/lib/utils/cn'

const PRIMARY: readonly CookieFormat[] = ['netscape', 'cookie-editor', 'puppeteer']
const MORE: readonly CookieFormat[] = ['key-value', 'header']

interface TargetTabsProps {
  value: CookieFormat
  onChange: (format: CookieFormat) => void
  dict: Dictionary
}

export function TargetTabs({ value, onChange, dict }: TargetTabsProps) {
  const [open, setOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const moreSelected = MORE.includes(value)

  useEffect(() => {
    if (!open || !moreRef.current) {
      setMenuPos(null)
      return
    }
    function place() {
      const r = moreRef.current?.getBoundingClientRect()
      if (!r) return
      const width = 136
      setMenuPos({
        top: r.bottom + 4,
        left: Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8),
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (moreRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function tabClass(selected: boolean) {
    return cn(
      'inline-flex items-center cursor-pointer rounded-[6px] px-2.5 py-1 whitespace-nowrap',
      'font-sans text-detail-xs font-medium transition-colors duration-200 ease-ant',
      selected ? 'bg-ink/[0.06] text-ink' : 'text-ink-faint hover:text-ink',
    )
  }

  return (
    <div role="tablist" aria-label={dict.converter.convertTo} className="flex min-w-0 flex-wrap items-center justify-end gap-0.5">
      {PRIMARY.map((format) => {
        const selected = format === value
        return (
          <button
            key={format}
            role="tab"
            type="button"
            aria-selected={selected}
            title={dict.formats[format].hint}
            onClick={() => onChange(format)}
            className={tabClass(selected)}
          >
            {dict.formats[format].label}
          </button>
        )
      })}

      <div ref={moreRef} className="relative">
        <button
          type="button"
          role="tab"
          aria-selected={moreSelected}
          aria-expanded={open}
          aria-haspopup="listbox"
          title={dict.converter.tabsMore}
          onClick={() => setOpen((v) => !v)}
          className={tabClass(moreSelected)}
        >
          {moreSelected ? dict.formats[value].label : dict.converter.tabsMore}
          <svg viewBox="0 0 12 12" className="ms-1 size-2.5 text-ink-faint" fill="none" aria-hidden>
            <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
        {open && menuPos && typeof document !== 'undefined'
          ? createPortal(
              <div
                ref={menuRef}
                role="listbox"
                style={{ top: menuPos.top, left: menuPos.left }}
                className="fixed z-[80] min-w-[8.5rem] rounded-main border border-line bg-surface py-1 shadow-none"
              >
                {MORE.map((format) => (
                  <button
                    key={format}
                    type="button"
                    role="option"
                    aria-selected={format === value}
                    title={dict.formats[format].hint}
                    onClick={() => {
                      onChange(format)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full cursor-pointer px-3 py-1.5 text-left font-sans text-detail-xs',
                      format === value ? 'bg-ink/[0.06] text-ink' : 'text-ink-secondary hover:text-ink',
                    )}
                  >
                    {dict.formats[format].label}
                  </button>
                ))}
              </div>,
              document.body,
            )
          : null}
      </div>
    </div>
  )
}
