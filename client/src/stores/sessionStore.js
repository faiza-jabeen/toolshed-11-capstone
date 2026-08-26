import { create } from 'zustand';
import * as http from '../api/http.js';
import { toast } from './uiStore.js';

/**
 * REFACTOR 1 of 2 — the auth session.
 *
 * Task 04 held this in a React context: <AuthProvider> wrapped the tree, and
 * every component that wanted the user called useAuth(). That worked, but the
 * provider had to sit above everything, non-React code (the fetch wrapper)
 * could not read the session at all, and any state change re-rendered every
 * consumer whether or not it used the part that changed.
 *
 * As a store: no provider, `getState()` works outside React, and selectors mean
 * a component that only reads `user.name` does not re-render when `status` flips.
 */
export const useSessionStore = create((set, get) => ({
  user: null,
  status: 'booting',              // booting | anonymous | authenticated

  adopt: (session) => {
    // Never flip to 'authenticated' on a malformed session. Doing so leaves
    // every consumer reading user.name off undefined — which is exactly the
    // crash the integration tests found.
    if (!session?.user || !session?.accessToken) {
      get().clear();
      return;
    }
    http.setAccessToken(session.accessToken);
    set({ user: session.user, status: 'authenticated' });
  },

  clear: () => {
    http.setAccessToken(null);
    set({ user: null, status: 'anonymous' });
  },

  boot: async () => {
    http.setUnauthorizedHandler(() => get().silentRefresh());
    await get().silentRefresh();
  },

  silentRefresh: async () => {
    try { get().adopt(await http.refresh()); return true; }
    catch { get().clear(); return false; }
  },

  login: async (credentials) => {
    get().adopt(await http.login(credentials));
    toast.ok(`Signed in as ${get().user.name}.`);
  },

  logout: async () => {
    try { await http.logout(); }
    finally { get().clear(); toast.ok('Signed out.'); }
  },
}));

/** Selectors, exported so components never subscribe to more than they use. */
export const selectUser = (s) => s.user;
export const selectIsKeeper = (s) => s.user?.role === 'keeper';
export const selectSessionStatus = (s) => s.status;
