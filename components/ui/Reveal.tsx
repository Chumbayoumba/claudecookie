'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'

interface RevealProps {
  children: ReactNode
  /** Seconds to hold before starting, for staggering siblings. */
  delay?: number
  className?: string
}

/**
 * Fades a section up as it scrolls into view, once.
 *
 * The distance is deliberately small (16px) and the curve is the site easing -
 * the effect should register as the page settling, not as an entrance.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  return (
    // Transform-only (no opacity): these wrappers hold whole content sections
    // (how-it-works, the FAQ, the format cards). Fading opacity from 0 left all
    // of that text at opacity:0 in the static HTML, invisible to any crawler
    // that respects computed CSS and does not simulate a scroll. Animating only
    // `y` keeps the rise-on-scroll while the prose is always present and visible.
    <motion.div
      className={className}
      initial={{ y: 16 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: [0.165, 0.84, 0.44, 1] }}
    >
      {children}
    </motion.div>
  )
}
