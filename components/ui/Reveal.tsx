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
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, delay, ease: [0.165, 0.84, 0.44, 1] }}
    >
      {children}
    </motion.div>
  )
}
