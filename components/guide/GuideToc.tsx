interface GuideTocProps {
  label: string
  items: { id: string; title: string }[]
}

export function GuideToc({ label, items }: GuideTocProps) {
  return (
    <nav aria-label={label} className="mt-10 lg:sticky lg:top-24 lg:mt-8">
      <p className="font-sans text-detail-xs font-semibold tracking-[0.08em] text-ink-faint uppercase">
        {label}
      </p>
      <ol className="mt-3 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="ant-link font-sans text-detail-s text-ink-secondary hover:text-ink"
            >
              {item.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
