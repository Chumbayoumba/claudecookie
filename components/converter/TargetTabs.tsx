'use client'

import { ALL_FORMATS, type CookieFormat } from '@/lib/cookies'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { cn } from '@/lib/utils/cn'

interface TargetTabsProps {
  value: CookieFormat
  onChange: (format: CookieFormat) => void
  dict: Dictionary
}

/**
 * Output format picker.
 *
 * All five formats are always offered, including converting a format to itself -
 * running a hand-edited cookies.txt back through Netscape output is a genuinely
 * useful way to normalise spacing and flags.
 */
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
              'relative cursor-pointer rounded-small px-2.5 py-1 whitespace-nowrap',
              'font-sans text-detail-xs font-medium transition-colors duration-200 ease-ant',
              selected
                ? 'bg-clay/5 text-ink'
                : 'text-ink-faint hover:bg-surface-hover hover:text-ink',
            )}
          >
            {dict.formats[format].label}
          </button>
        )
      })}
    </div>
  )
}
