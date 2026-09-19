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
 * Raises a section into place as it scrolls into view, once.
 *
 * Transform-only (no opacity) so crawlers still see the prose. The distance is
 * small (~6px) and the curve is the site easing — the page settling, not an entrance.
 */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  return (
    // Transform-only (no opacity): these wrappers hold whole content sections
    // (how-it-works, the FAQ, the format cards). Opacity 0 in the static HTML
    // hid that text from crawlers that respect computed CSS and do not simulate
    // a scroll. Animating only `y` keeps the rise-on-scroll while the prose is
    // always present and visible.
    <motion.div
      className={className}
      initial={{ y: 6 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.25, delay, ease: [0.165, 0.84, 0.44, 1] }}
    >
      {children}
    </motion.div>
  )
}
