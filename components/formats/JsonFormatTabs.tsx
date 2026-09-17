'use client'

import { useState } from 'react'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { cn } from '@/lib/utils/cn'

export interface JsonFormatTab {
  id: string
  /** Short underline-tab label (`entry.tab`). */
  label: string
  title: string
  body: string
  usedBy: string
  code: string
  syntax: 'json' | 'text'
  capabilities: { label: string; on: boolean }[]
}

interface JsonFormatTabsProps {
  tabs: JsonFormatTab[]
  usedByLabel: string
  exampleLabel: string
  yesLabel: string
  noLabel: string
}

export function JsonFormatTabs({
  tabs,
  usedByLabel,
  exampleLabel,
  yesLabel,
  noLabel,
}: JsonFormatTabsProps) {
  const [active, setActive] = useState(tabs[0]?.id ?? '')

  return (
    <div>
      <div
        role="tablist"
        aria-label="JSON formats"
        className="ant-scroll flex gap-6 overflow-x-auto border-b border-line"
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
                '-mb-px shrink-0 border-b-2 px-0 py-2.5 font-sans text-detail-s font-medium',
                'transition-colors duration-200 ease-ant',
                selected
                  ? 'border-ink text-ink'
                  : 'border-transparent text-ink-secondary hover:text-ink',
              )}
            >
              {tab.label}
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
              <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
                <div>
                  <h3 className="text-display-xs sm:text-display-s">{tab.title}</h3>
                  <p className="mt-4 max-w-[62ch] text-paragraph-xs text-ink-secondary">
                    {tab.body}
                  </p>
                  <p className="mt-3 font-sans text-detail-xs text-ink-faint">
                    <span className="tracking-[0.08em] uppercase">{usedByLabel}</span>
                    {' — '}
                    {tab.usedBy}
                  </p>
                  <dl className="mt-6 flex flex-col gap-2">
                    {tab.capabilities.map((cap) => (
                      <div
                        key={cap.label}
                        className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-b-0"
                      >
                        <dt className="font-sans text-detail-s text-ink-secondary">{cap.label}</dt>
                        <dd
                          className={cn(
                            'font-sans text-detail-s',
                            cap.on ? 'text-ok' : 'text-ink-faint',
                          )}
                          aria-label={cap.on ? yesLabel : noLabel}
                        >
                          {cap.on ? yesLabel : noLabel}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <CodeBlock code={tab.code} syntax={tab.syntax} caption={exampleLabel} />
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
