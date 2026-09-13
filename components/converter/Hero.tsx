'use client'

import { motion } from 'motion/react'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'

const EASE = [0.165, 0.84, 0.44, 1] as const

/**
 * Page headline.
 *
 * The three lines rise in sequence with a 70ms offset - enough to read as
 * deliberate, short enough that the tool below is never waiting on it.
 */
export function Hero({ dict }: { dict: Dictionary }) {
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay, ease: EASE },
  })

  return (
    <div className="relative z-10 max-w-3xl">
      <motion.p
        {...rise(0)}
        className="font-sans text-detail-xs font-semibold tracking-[0.12em] text-clay uppercase"
      >
        {dict.hero.eyebrow}
      </motion.p>

      <motion.h1
        {...rise(0.07)}
        className="mt-5 text-display-m leading-[1.05] sm:text-display-l lg:text-display-xl"
      >
        {dict.hero.title}
      </motion.h1>

      <motion.p
        {...rise(0.14)}
        className="mt-6 max-w-2xl text-paragraph-xs text-ink-secondary sm:text-paragraph-s"
      >
        {dict.hero.subtitle}
      </motion.p>

      <motion.p
        {...rise(0.21)}
        className="mt-5 inline-flex items-center gap-2 font-sans text-detail-s text-ink-faint"
      >
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
      </motion.p>
    </div>
  )
}
