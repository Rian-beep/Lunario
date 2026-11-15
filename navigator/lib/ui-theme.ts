export type UiTheme = 'light' | 'dark';
export const UI_THEME_KEY = 'lunario-ui-theme';
/** Missing or unknown preference defaults to dark (judging / first-visit default). */
export const parseUiTheme = (value: unknown): UiTheme => (value === 'light' ? 'light' : 'dark');
let current: UiTheme = 'dark';
let initialized = false;
const listeners = new Set<() => void>();
export function applyUiTheme(root: Pick<HTMLElement, 'dataset' | 'classList'>, theme: UiTheme) {
  root.dataset.uiTheme = theme;
  root.classList.toggle('dark', theme === 'dark');
}
function publish(theme: UiTheme) {
  current = theme;
  if (typeof document !== 'undefined') applyUiTheme(document.documentElement, theme);
  listeners.forEach(listener => listener());
}
export function getUiTheme(): UiTheme { return current; }
export function setUiTheme(theme: UiTheme) {
  initialized = true;
  publish(theme);
  try { window.localStorage.setItem(UI_THEME_KEY, theme); } catch { /* Theme still works when preference storage is unavailable. */ }
}
export function subscribeUiTheme(listener: () => void) {
  listeners.add(listener);
  if (!initialized && typeof window !== 'undefined') {
    initialized = true;
    let stored: unknown;
    try { stored = window.localStorage.getItem(UI_THEME_KEY); } catch { /* Optional preference storage. */ }
    publish(parseUiTheme(stored));
  }
  const sync = (event: StorageEvent) => { if (event.key === UI_THEME_KEY || event.key === null) publish(parseUiTheme(event.newValue)); };
  if (typeof window !== 'undefined') window.addEventListener('storage', sync);
  return () => { listeners.delete(listener); if (typeof window !== 'undefined') window.removeEventListener('storage', sync); };
}
