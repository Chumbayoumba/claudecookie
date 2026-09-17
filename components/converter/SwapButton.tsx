'use client'

import { motion } from 'motion/react'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

interface SwapButtonProps {
  onSwap: () => void
  disabled: boolean
  label: string
}

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
        'grid size-9 shrink-0 cursor-pointer place-items-center rounded-round',
        'border border-line-tool bg-surface text-ink',
        'transition-[background-color,border-color,opacity] duration-[180ms] ease-ant',
        'hover:bg-surface-hover',
        'disabled:pointer-events-none disabled:opacity-35',
      )}
    >
      <motion.span
        animate={{ rotate: turns * 180 }}
        transition={{ duration: 0.18, ease: [0.165, 0.84, 0.44, 1] }}
        className="grid place-items-center"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4 rotate-90 lg:rotate-0"
          fill="none"
          aria-hidden
        >
          <path
            d="M7 8h10M17 8l-3-3M17 8l-3 3M17 16H7M7 16l3-3M7 16l3 3"
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
