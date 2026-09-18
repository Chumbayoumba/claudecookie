/**
 * Turnstile auto-solves as soon as the widget mounts. If we remount it after a
 * failed generate, Cloudflare fires another token and /credential runs again.
 */
export function shouldMountTurnstile(
  converting: boolean,
  convertError: string | null,
): boolean {
  return !converting && convertError === null
}

/** A late captcha token must not start /credential after the attempt ended. */
export function canStartGenerate(
  pending: number | null,
  locked: boolean,
): pending is number {
  return pending !== null && !locked
}
