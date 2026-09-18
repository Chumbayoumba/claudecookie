'use client'

import { useState } from 'react'

export function CopyButton({ text, copyLabel, copiedLabel }: { text: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false)

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className="absolute top-2.5 right-2.5 rounded-small bg-bg-secondary px-2.5 py-1 font-sans text-detail-xs text-ink-secondary transition-colors duration-200 ease-ant hover:bg-surface-hover hover:text-ink"
    >
      {copied ? copiedLabel : copyLabel}
    </button>
  )
}
