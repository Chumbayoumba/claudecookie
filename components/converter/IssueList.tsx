'use client'

import { AnimatePresence, motion } from 'motion/react'
import type { ParseIssue } from '@/lib/cookies'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { cn } from '@/lib/utils/cn'

interface IssueListProps {
  issues: ParseIssue[]
  dict: Dictionary
}

type IssueKey = keyof Dictionary['issues']

/**
 * Parser errors and warnings.
 *
 * Issues carry translation keys rather than prose, so the same parser output is
 * rendered in whichever language the visitor is reading.
 */
export function IssueList({ issues, dict }: IssueListProps) {
  // Repeated per-line issues collapse into one row carrying the line numbers.
  const grouped = new Map<string, { issue: ParseIssue; lines: number[] }>()

  for (const issue of issues) {
    const existing = grouped.get(issue.message)
    if (existing) {
      if (issue.line !== undefined) existing.lines.push(issue.line)
    } else {
      grouped.set(issue.message, {
        issue,
        lines: issue.line !== undefined ? [issue.line] : [],
      })
    }
  }

  const rows = [...grouped.values()].sort((a, b) =>
    a.issue.level === b.issue.level ? 0 : a.issue.level === 'error' ? -1 : 1,
  )

  return (
    <AnimatePresence initial={false}>
      {rows.length > 0 && (
        <motion.ul
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.28, ease: [0.165, 0.84, 0.44, 1] }}
          className="overflow-hidden"
        >
          <div className="flex flex-col gap-2 pt-4">
            {rows.map(({ issue, lines }) => {
              const text = dict.issues[issue.message as IssueKey] ?? issue.message
              const shown = lines.slice(0, 6)
              const isError = issue.level === 'error'

              return (
                <li
                  key={issue.message}
                  className={cn(
                    'flex gap-2.5 rounded-main border px-3 py-2.5 font-sans text-detail-s',
                    isError
                      ? 'border-error/30 bg-error/8 text-ink'
                      : 'border-warn/35 bg-warn/10 text-ink',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'mt-[0.35rem] size-1.5 shrink-0 rounded-round',
                      isError ? 'bg-error' : 'bg-warn',
                    )}
                  />
                  <span className="leading-relaxed">
                    {text}
                    {shown.length > 0 && (
                      <span className="ml-1.5 font-mono text-detail-xs text-ink-faint">
                        {shown.map((n) => `L${n}`).join(' ')}
                        {lines.length > shown.length ? ` +${lines.length - shown.length}` : ''}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </div>
        </motion.ul>
      )}
    </AnimatePresence>
  )
}
