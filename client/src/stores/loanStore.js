import { create } from 'zustand';
import { useShallow } from 'zustand/shallow';
import { api } from '../api/http.js';
import { toast } from './uiStore.js';

/** The loans resource. Mirrors catalogueStore so the two read the same way. */
export const useLoanStore = create((set, get) => ({
  loans: [],
  status: 'idle',
  error: null,
  busy: {},            // loanId -> action in flight
  borrowing: null,     // toolId currently being borrowed

  load: async (params = {}) => {
    set({ status: 'loading', error: null });
    try {
      const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
      set({ loans: await api(`/loans${qs.toString() ? `?${qs}` : ''}`, { auth: true }), status: 'ready' });
    } catch (error) {
      set({ status: 'error', error, loans: [] });
    }
  },

  borrow: async (tool, body = {}) => {
    set({ borrowing: tool.id });
    try {
      const loan = await api('/loans', { method: 'POST', auth: true, body: { toolId: tool.id, ...body } });
      set((s) => ({ loans: [loan, ...s.loans] }));
      toast.ok(`${tool.assetTag} is yours until ${loan.dueOn}.`);
      return { ok: true, loan };
    } catch (error) {
      toast.fail(error.message);
      return { ok: false, fields: error.fields, error };
    } finally {
      set({ borrowing: null });
    }
  },

  patch: async (id, body, action = 'save') => {
    set((s) => ({ busy: { ...s.busy, [id]: action } }));
    try {
      const updated = await api(`/loans/${id}`, { method: 'PATCH', auth: true, body });
      set((s) => ({ loans: s.loans.map((l) => (l.id === updated.id ? updated : l)) }));
      return { ok: true, loan: updated };
    } catch (error) {
      toast.fail(error.message);
      return { ok: false, fields: error.fields };
    } finally {
      set((s) => ({ busy: { ...s.busy, [id]: undefined } }));
    }
  },

  checkIn: async (loan) => {
    const res = await get().patch(loan.id, { returned: true }, 'return');
    if (res.ok) toast.ok(`${loan.tool?.assetTag ?? 'Tool'} is back on the shelf.`);
    return res;
  },
}));

/* --- selectors -----------------------------------------------------------
   Derived, never stored, so they cannot disagree with `loans`. Anything that
   builds a fresh array goes through useShallow — Zustand v5 compares with
   Object.is, and a new reference every read is an infinite render loop.     */
export const selectOpen    = (s) => s.loans.filter((l) => !l.returnedOn);
export const selectOverdue = (s) => s.loans.filter((l) => !l.returnedOn && l.overdue);
export const selectClosed  = (s) => s.loans.filter((l) => l.returnedOn);
export const selectLoanBusy = (id) => (s) => s.busy[id];

export const useOpenLoans    = () => useLoanStore(useShallow(selectOpen));
export const useOverdueLoans = () => useLoanStore(useShallow(selectOverdue));
export const useClosedLoans  = () => useLoanStore(useShallow(selectClosed));
