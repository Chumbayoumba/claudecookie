import { highlight } from '@/lib/utils/highlight'
import { cn } from '@/lib/utils/cn'

interface CodeBlockProps {
  code: string
  syntax?: 'json' | 'text'
  /** Small caption above the block, e.g. a filename. */
  caption?: string
  className?: string
}

/**
 * Static code sample for the reference pages.
 *
 * Highlighting happens at build time here rather than in the browser, so these
 * pages ship no JavaScript for it at all.
 */
export function CodeBlock({ code, syntax = 'text', caption, className }: CodeBlockProps) {
  const highlighted = highlight(code, syntax)

  return (
    <figure className={cn('overflow-hidden rounded-large border border-line bg-surface', className)}>
      {caption && (
        <figcaption className="border-b border-line px-4 py-2.5 font-mono text-detail-xs text-ink-faint">
          {caption}
        </figcaption>
      )}
      <div className="ant-scroll overflow-x-auto">
        <pre
          className={cn(
            'px-4 py-4 font-mono text-detail-xs leading-relaxed text-ink',
            syntax === 'json' ? 'ant-json' : 'ant-netscape',
          )}
        >
          {highlighted !== null ? (
            <code dangerouslySetInnerHTML={{ __html: highlighted }} />
          ) : (
            <code>{code}</code>
          )}
        </pre>
      </div>
    </figure>
  )
}
