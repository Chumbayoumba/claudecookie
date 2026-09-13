/**
 * Height of the scrolling body inside both converter panels.
 *
 * It has to be a *definite* height, not a min-height. The two sides hold wildly
 * different amounts of text for the same data - a Cookie-Editor export is about
 * six times the height of the Netscape file it came from, because every cookie
 * becomes eleven lines instead of one. With a min-height the taller side
 * stretches the page and the shorter side trails a screenful of blank space.
 *
 * Both panels import this, because if the two values ever drift apart the
 * panels stop lining up.
 *
 * `min(vh, rem)` keeps it proportional on a short laptop screen while capping it
 * on a large monitor, where a panel taller than about 36rem just puts the
 * Convert button and the counters below the fold.
 */
export const PANEL_BODY_HEIGHT = 'h-[min(52vh,26rem)] lg:h-[min(62vh,36rem)]'
