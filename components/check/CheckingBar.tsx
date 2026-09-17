'use client'

import { motion } from 'motion/react'

export function CheckingBar({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="h-0.5 overflow-hidden bg-bg-tertiary" aria-hidden>
      <motion.div
        className="h-full w-1/3 bg-clay"
        animate={{ x: ['-120%', '340%'] }}
        transition={{ duration: 1.15, repeat: Infinity, ease: [0.165, 0.84, 0.44, 1] }}
      />
    </div>
  )
}
