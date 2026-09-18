/**
 * Safe download names for checked cookie sets: email local-part, plan, valid.
 * Never put the cookie value in the filename.
 */

function slug(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[^\w.+-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .toLowerCase()
}

export function cookieFileSlug(email?: string | null, plan?: string | null): string {
  const fromEmail = email?.includes('@') ? email.split('@')[0] : email
  const user = slug(fromEmail || '') || 'account'
  const planPart = slug((plan || '').replace(/^claude\s+/i, '')) || 'plan'
  return `${user}-${planPart}-valid`
}

export function uniqueFilename(seen: Map<string, number>, base: string, ext = 'txt'): string {
  const n = (seen.get(base) ?? 0) + 1
  seen.set(base, n)
  return n === 1 ? `${base}.${ext}` : `${base}-${n}.${ext}`
}

export function validCookieFiles(
  rows: { raw: string; email?: string | null; plan?: string | null }[],
): { name: string; text: string }[] {
  const seen = new Map<string, number>()
  return rows.map((row) => ({
    name: uniqueFilename(seen, cookieFileSlug(row.email, row.plan)),
    text: row.raw,
  }))
}
