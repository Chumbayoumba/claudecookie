import { cn } from '@/lib/utils/cn'

interface CredentialStepsProps {
  current: 1 | 2 | 3
  paste: string
  verify: string
  generate: string
}

export function CredentialSteps({ current, paste, verify, generate }: CredentialStepsProps) {
  const steps = [
    { n: 1 as const, label: paste },
    { n: 2 as const, label: verify },
    { n: 3 as const, label: generate },
  ]

  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {steps.map((step, i) => {
        const done = current > step.n
        const active = current === step.n
        return (
          <li key={step.n} className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span
              className={cn(
                'inline-flex items-center gap-2 font-sans text-detail-s',
                active ? 'font-medium text-ink' : done ? 'text-ink-secondary' : 'text-ink-faint',
              )}
            >
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-round border font-mono text-[11px]',
                  active && 'border-clay bg-clay text-clay-contrast',
                  done && 'border-line bg-surface text-ink',
                  !active && !done && 'border-line bg-bg-secondary text-ink-faint',
                )}
              >
                {done ? <StepDone /> : step.n}
              </span>
              {step.label}
            </span>
            {i < steps.length - 1 ? (
              <span aria-hidden className="hidden h-px w-6 bg-line-strong sm:block md:w-10" />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function StepDone() {
  return (
    <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden>
      <path
        d="m2.5 6.2 2.3 2.3 4.7-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
