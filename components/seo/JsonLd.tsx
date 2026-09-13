/**
 * Emits a JSON-LD block.
 *
 * `JSON.stringify` output is escaped for `<` so a value containing `</script>`
 * cannot break out of the tag.
 */
export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
