import { create } from 'zustand';
import { applyTheme, resolveTheme, watchSystemTheme } from '../lib/theme.js';

let seq = 0;

/** Toasts and theme — the two pieces of state every screen can touch. */
export const useUiStore = create((set, get) => ({
  toasts: [],
  theme: typeof document !== 'undefined' ? (document.documentElement.dataset.theme || 'light') : 'light',

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  push: (tone, message) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, tone, message }] }));
    setTimeout(() => get().dismiss(id), tone === 'error' ? 7000 : 4000);
  },

  setTheme: (theme) => { applyTheme(theme); set({ theme }); },
  toggleTheme: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),

  initTheme: () => {
    const theme = resolveTheme();
    applyTheme(theme);
    set({ theme });
    return watchSystemTheme((next) => { applyTheme(next); set({ theme: next }); });
  },
}));

export const toast = {
  ok: (m) => useUiStore.getState().push('ok', m),
  fail: (m) => useUiStore.getState().push('error', m),
};
