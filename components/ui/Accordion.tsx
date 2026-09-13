'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

export interface AccordionItem {
  q: string
  a: string
}

interface AccordionProps {
  items: AccordionItem[]
  /** Index to open on first render. Pass -1 to start fully collapsed. */
  defaultOpen?: number
}

/**
 * FAQ accordion.
 *
 * Answers stay in the DOM whether open or closed - they are the FAQPage
 * structured data on this page, so they must be crawlable. The open/close
 * animation is the `grid-template-rows: 0fr -> 1fr` trick, which transitions to
 * the content's natural height without measuring anything in JavaScript.
 */
export function Accordion({ items, defaultOpen = 0 }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item, i) => {
        const isOpen = open === i
        const panelId = `faq-panel-${i}`
        const buttonId = `faq-button-${i}`

        return (
          <div key={item.q}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? -1 : i)}
                className={cn(
                  'group flex w-full cursor-pointer items-start justify-between gap-6',
                  'py-5 text-left font-sans text-detail-l font-medium',
                  'transition-colors duration-200 ease-ant hover:text-clay',
                  isOpen ? 'text-ink' : 'text-ink',
                )}
              >
                <span>{item.q}</span>
                <span
                  aria-hidden
                  className={cn(
                    'relative mt-1 grid size-5 shrink-0 place-items-center',
                    'transition-transform duration-300 ease-ant',
                    isOpen && 'rotate-45',
                  )}
                >
                  <span className="absolute h-px w-4 bg-current" />
                  <span className="absolute h-4 w-px bg-current" />
                </span>
              </button>
            </h3>

            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-300 ease-ant',
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                <p className="max-w-[62ch] pb-6 text-paragraph-xs text-ink-secondary">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
