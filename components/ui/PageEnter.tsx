'use client'

import { motion } from 'motion/react'
import type { ReactNode } from 'react'

const EASE = [0.165, 0.84, 0.44, 1] as const

interface PageEnterProps {
  children: ReactNode
  delay?: number
  className?: string
}

/** Transform-only rise. Indexable text stays visible without JS. */
export function PageEnter({ children, delay = 0, className }: PageEnterProps) {
  return (
    <motion.div
      className={className}
      initial={{ y: 10 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.36, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
