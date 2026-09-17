'use client'

import { ALL_FORMATS, type CookieFormat } from '@/lib/cookies'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { cn } from '@/lib/utils/cn'

interface TargetTabsProps {
  value: CookieFormat
  onChange: (format: CookieFormat) => void
  dict: Dictionary
}

export function TargetTabs({ value, onChange, dict }: TargetTabsProps) {
  return (
    <div
      role="tablist"
      aria-label={dict.converter.convertTo}
      className="ant-scroll -mx-1 flex gap-0.5 overflow-x-auto px-1"
    >
      {ALL_FORMATS.map((format) => {
        const selected = format === value
        return (
          <button
            key={format}
            role="tab"
            type="button"
            aria-selected={selected}
            title={dict.formats[format].hint}
            onClick={() => onChange(format)}
            className={cn(
              'relative cursor-pointer px-2.5 py-1 whitespace-nowrap',
              'font-sans text-detail-xs font-medium transition-colors duration-200 ease-ant',
              selected
                ? 'bg-clay/5 text-ink after:absolute after:inset-x-2 after:bottom-0 after:h-px after:bg-clay'
                : 'text-ink-faint hover:text-ink',
            )}
          >
            {dict.formats[format].label}
          </button>
        )
      })}
    </div>
  )
}
