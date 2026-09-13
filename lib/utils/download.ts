/**
 * Saves text as a file using an object URL.
 *
 * A Blob is used rather than a `data:` URI so that large outputs do not hit the
 * URL length limits browsers apply to data URIs.
 */
export function downloadText(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()

  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
