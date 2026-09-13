'use client'

import { motion } from 'motion/react'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

interface SwapButtonProps {
  onSwap: () => void
  disabled: boolean
  label: string
}

/**
 * Flips the conversion: the current output becomes the input, and the target
 * becomes whatever the input was recognised as.
 *
 * The rotation accumulates rather than toggling between 0 and 180, so every
 * press turns the same way instead of winding back.
 */
export function SwapButton({ onSwap, disabled, label }: SwapButtonProps) {
  const [turns, setTurns] = useState(0)

  function handleClick() {
    setTurns((t) => t + 1)
    onSwap()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'group grid size-11 shrink-0 cursor-pointer place-items-center rounded-round',
        'border border-line bg-surface text-ink',
        'transition-[background-color,border-color,opacity] duration-200 ease-ant',
        'hover:border-clay hover:bg-clay hover:text-clay-contrast',
        'disabled:pointer-events-none disabled:opacity-35',
      )}
    >
      <motion.span
        animate={{ rotate: turns * 180 }}
        transition={{ duration: 0.45, ease: [0.165, 0.84, 0.44, 1] }}
        className="grid place-items-center"
      >
        {/* Arrows point left/right on wide screens where the panels sit side by
            side, and up/down once they stack. */}
        <svg
          viewBox="0 0 24 24"
          className="size-5 rotate-90 lg:rotate-0"
          fill="none"
          aria-hidden
        >
          <path
            d="M7 7h10l-3-3M17 17H7l3 3"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </motion.span>
    </button>
  )
}
