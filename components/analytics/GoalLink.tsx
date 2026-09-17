'use client'

import type { ReactNode } from 'react'
import { metrikaGoal } from '@/lib/analytics'

interface GoalLinkProps {
  href: string
  /** Yandex Metrika goal fired on click (best-effort). */
  goal: string
  className?: string
  children: ReactNode
}

/**
 * A plain anchor (full-page navigation, matching the site's no-next/link policy)
 * that fires a Metrika conversion goal on click. Used for CTAs that live inside
 * server components, which cannot attach an onClick themselves.
 */
export function GoalLink({ href, goal, className, children }: GoalLinkProps) {
  return (
    <a href={href} className={className} onClick={() => metrikaGoal(goal)}>
      {children}
    </a>
  )
}
