/**
 * Theme resolution, in the order a user would expect:
 *   an explicit choice they made  →  their OS setting  →  light
 *
 * The initial paint is handled by an inline script in index.html, before React
 * loads. Doing it here instead would show a white flash on every load for dark
 * mode users — the "flash of incorrect theme" everyone ships once.
 */
const KEY = 'toolshed-theme';

export const systemTheme = () =>
  window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export const storedTheme = () => {
  try { return localStorage.getItem(KEY); } catch { return null; }   // private mode throws
};

export const resolveTheme = () => storedTheme() ?? systemTheme();

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0C1A15' : '#14332A');
  try { localStorage.setItem(KEY, theme); } catch { /* nothing we can do */ }
}

/** Follow the OS until the user overrides it explicitly. */
export function watchSystemTheme(onChange) {
  const query = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (!query) return () => {};
  const handler = (e) => { if (!storedTheme()) onChange(e.matches ? 'dark' : 'light'); };
  query.addEventListener('change', handler);
  return () => query.removeEventListener('change', handler);
}
