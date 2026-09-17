interface DataFlowProps {
  title: string
  steps: string[]
  note: string
}

export function DataFlow({ title, steps, note }: DataFlowProps) {
  return (
    <section className="rounded-large border border-line bg-surface p-6">
      <h3 className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
        {title}
      </h3>
      <ol className="mt-5 flex flex-col">
        {steps.map((step, i) => (
          <li key={step} className="flex flex-col items-start">
            <span className="rounded-main border border-line bg-bg-secondary px-3 py-2 font-sans text-detail-s text-ink">
              {step}
            </span>
            {i < steps.length - 1 ? (
              <span aria-hidden className="my-1 ml-4 h-4 w-px bg-line-strong" />
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-5 font-sans text-detail-s text-ink-secondary">{note}</p>
    </section>
  )
}
