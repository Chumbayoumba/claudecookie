/**
 * Applies the saved theme before first paint.
 *
 * This has to run synchronously in the document head: anything later (an
 * effect, a deferred script) lets the light theme paint first and flash.
 */
export function ThemeScript() {
  const script = `
(function(){
  try {
    var saved = localStorage.getItem('cctheme');
    var theme = saved === 'light' || saved === 'dark'
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();`

  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
