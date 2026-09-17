'use client'

import { motion } from 'motion/react'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

const EASE = [0.165, 0.84, 0.44, 1] as const

/**
 * Page headline. One or two transform-only rises — no opacity, no four-wave
 * stagger — so the converter below is ready as soon as the title settles.
 */
export function Hero({ dict }: { dict: Dictionary }) {
  // Transform-only rise (no opacity): the headline is the LCP element and part
  // of the indexable body, so it must never ship at opacity:0 in the static
  // HTML - a crawler that does not run the JS would see a blank hero. Animating
  // only `y` keeps the "settling" motion while leaving the text visible.
  const rise = (delay: number) => ({
    initial: { y: 4 },
    animate: { y: 0 },
    transition: { duration: 0.22, delay, ease: EASE },
  })

  return (
    <div className="relative z-10 max-w-3xl">
      <motion.div {...rise(0)}>
        <p className="font-sans text-detail-xs font-semibold tracking-[0.12em] text-clay uppercase">
          {dict.hero.eyebrow}
        </p>
        <h1 className="mt-3 text-display-m leading-[1.1] sm:text-display-l">
          {dict.hero.title}
        </h1>
      </motion.div>

      <motion.div {...rise(0.05)}>
        <p className="mt-4 max-w-2xl text-paragraph-xs text-ink-secondary">
          {dict.hero.subtitle}
        </p>
        {dict.hero.formats ? (
          <p className="mt-3 font-mono text-detail-xs text-ink-faint">{dict.hero.formats}</p>
        ) : null}
        <p className="mt-4 inline-flex items-center gap-2 font-sans text-detail-s text-ink-faint">
          <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-ok" fill="none" aria-hidden>
            <path
              d="M4.5 7V5.2a3.5 3.5 0 1 1 7 0V7"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <rect
              x="3"
              y="7"
              width="10"
              height="6.5"
              rx="1.6"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
          {dict.hero.privacy}
        </p>
      </motion.div>
    </div>
  )
}
