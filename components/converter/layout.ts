/**
 * Height of the scrolling body inside both converter panels.
 *
 * It has to be a *definite* height, not a min-height. The two sides hold wildly
 * different amounts of text for the same data — a Cookie-Editor export is about
 * six times the height of the Netscape file it came from. The user can drag the
 * handle under the editors to change this; these numbers are the starting point
 * and the clamp.
 */
export const DEFAULT_EDITOR_PX = 216
export const MIN_EDITOR_PX = 140
export const MAX_EDITOR_PX = 640

export function clampEditorPx(px: number, viewportH = typeof window === 'undefined' ? 800 : window.innerHeight) {
  const cap = Math.min(MAX_EDITOR_PX, Math.round(viewportH * 0.7))
  return Math.min(cap, Math.max(MIN_EDITOR_PX, Math.round(px)))
}
