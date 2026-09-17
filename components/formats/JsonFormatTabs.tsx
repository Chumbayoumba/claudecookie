'use client'

import { useState } from 'react'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { cn } from '@/lib/utils/cn'

export interface JsonFormatTab {
  id: string
  title: string
  body: string
  usedBy: string
  code: string
  syntax: 'json' | 'text'
}

interface JsonFormatTabsProps {
  tabs: JsonFormatTab[]
  usedByLabel: string
  exampleLabel: string
}

export function JsonFormatTabs({ tabs, usedByLabel, exampleLabel }: JsonFormatTabsProps) {
  const [active, setActive] = useState(tabs[0]?.id ?? '')

  return (
    <div>
      <div
        role="tablist"
        aria-label="JSON formats"
        className="ant-scroll -mx-1 flex gap-1 overflow-x-auto px-1 pb-px"
      >
        {tabs.map((tab) => {
          const selected = tab.id === active
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={tab.id}
              onClick={() => setActive(tab.id)}
              className={cn(
                'shrink-0 rounded-main border px-3 py-2 font-sans text-detail-s font-medium',
                'transition-colors duration-200 ease-ant',
                selected
                  ? 'border-line bg-surface text-ink'
                  : 'border-transparent text-ink-secondary hover:bg-surface-hover hover:text-ink',
              )}
            >
              {tab.title}
            </button>
          )
        })}
      </div>

      <div className="mt-8">
        {tabs.map((tab) => {
          const selected = tab.id === active
          return (
            <section
              key={tab.id}
              id={tab.id}
              role="tabpanel"
              aria-labelledby={`tab-${tab.id}`}
              hidden={!selected}
              className="scroll-mt-28"
            >
              <h3 className="text-display-xs sm:text-display-s">{tab.title}</h3>
              <p className="mt-4 max-w-[62ch] text-paragraph-xs text-ink-secondary">{tab.body}</p>
              <p className="mt-3 font-sans text-detail-xs text-ink-faint">
                <span className="tracking-[0.08em] uppercase">{usedByLabel}</span>
                {' — '}
                {tab.usedBy}
              </p>
              <CodeBlock
                className="mt-6"
                code={tab.code}
                syntax={tab.syntax}
                caption={exampleLabel}
              />
            </section>
          )
        })}
      </div>
    </div>
  )
}
