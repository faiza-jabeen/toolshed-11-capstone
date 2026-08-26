import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';
import { api } from '../api/http.js';
import { toast } from './uiStore.js';

/**
 * REFACTOR 2 of 2 — the tool catalogue.
 *
 * Task 03 held the list, the filters, the per-row busy map and every handler
 * in App, then passed nine props down through ToolList to ToolRow. Adding one
 * feature meant threading one more prop through two components that did not
 * care about it. Now each component pulls exactly what it needs.
 */
export const useCatalogueStore = create((set, get) => ({
  tools: [],
  status: 'idle',            // idle | loading | ready | error
  error: null,
  term: '',
  category: '',
  rowBusy: {},               // id -> 'status' | 'delete'
  formBusy: false,

  setTerm: (term) => set({ term }),
  setCategory: (category) => set({ category }),
  clearFilters: () => set({ term: '', category: '' }),

  load: async () => {
    set({ status: 'loading', error: null });
    try {
      // api() already unwraps the { data } envelope — do not unwrap twice.
      const tools = await api('/tools');
      set({ tools, status: 'ready' });
    } catch (error) {
      set({ status: 'error', error, tools: [] });
    }
  },

  create: async (payload) => {
    set({ formBusy: true });
    try {
      const created = await api('/tools', { method: 'POST', body: payload, auth: true });
      set((s) => ({ tools: [...s.tools, created].sort((a, b) => a.assetTag.localeCompare(b.assetTag)) }));
      toast.ok(`${created.assetTag} added to the catalogue.`);
      return { ok: true };
    } catch (error) {
      toast.fail(error.message);
      return { ok: false, fields: error.fields };
    } finally {
      set({ formBusy: false });
    }
  },

  patch: async (id, changes, action = 'status') => {
    set((s) => ({ rowBusy: { ...s.rowBusy, [id]: action } }));
    try {
      const updated = await api(`/tools/${id}`, { method: 'PATCH', body: changes, auth: true });
      set((s) => ({ tools: s.tools.map((t) => (t.id === updated.id ? updated : t)) }));
      return { ok: true, tool: updated };
    } catch (error) {
      toast.fail(error.message);
      return { ok: false };
    } finally {
      set((s) => ({ rowBusy: { ...s.rowBusy, [id]: undefined } }));
    }
  },

  remove: async (tool) => {
    set((s) => ({ rowBusy: { ...s.rowBusy, [tool.id]: 'delete' } }));
    try {
      const res = await api(`/tools/${tool.id}`, { method: 'DELETE', auth: true, raw: true });
      // A tool with loan history is retired, not deleted — the server keeps the
      // row so the dashboard's figures stay honest. Reflect whichever happened.
      if (res.meta?.retired) {
        set((s) => ({ tools: s.tools.map((t) => (t.id === tool.id ? res.data : t)) }));
      } else {
        set((s) => ({ tools: s.tools.filter((t) => t.id !== tool.id) }));
        toast.ok(`${tool.assetTag} removed from the catalogue.`);
      }
      return { ok: true, meta: res.meta };
    } catch (error) {
      toast.fail(error.message);
      return { ok: false };
    } finally {
      set((s) => ({ rowBusy: { ...s.rowBusy, [tool.id]: undefined } }));
    }
  },
}));

/* --- derived state -------------------------------------------------------
   Computed in a selector rather than stored, so it can never fall out of sync
   with `tools`. There is one list of tools and one place that filters it.     */
export const selectVisibleTools = (s) => {
  const q = s.term.trim().toLowerCase();
  return s.tools.filter((t) => {
    const inCat = !s.category || t.category === s.category;
    const hit = !q || t.name.toLowerCase().includes(q) ||
                t.assetTag.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q);
    return inCat && hit;
  });
};

export const selectCounts = (s) => ({
  total: s.tools.length,
  onShelf: s.tools.filter((t) => t.status === 'in').length,
  onLoan: s.tools.filter((t) => t.status === 'out').length,
  inRepair: s.tools.filter((t) => t.status === 'repair').length,
});

export const selectIsFiltering = (s) => Boolean(s.term || s.category);
export const selectRowBusy = (id) => (s) => s.rowBusy[id];

/* --- reference-stable hooks ------------------------------------------------
   Zustand v5 compares selector output with Object.is. A selector that builds a
   new array or object every call therefore looks "changed" on every store read,
   which re-renders, which reads again — an infinite loop. Anything returning a
   fresh reference has to go through useShallow, which compares contents instead.
   This bug is invisible until something actually renders the component, which
   is precisely why the integration tests in task 09 exist.                    */
export const useVisibleTools = () => useCatalogueStore(useShallow(selectVisibleTools));
export const useCounts       = () => useCatalogueStore(useShallow(selectCounts));
