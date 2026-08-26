import { describe, test, expect } from 'vitest';
import { useLoanStore, selectOpen, selectOverdue, selectClosed } from '../../stores/loanStore.js';
import { aLoan } from '../../test/factories.js';

/** Stores are plain JS — half the reason to use them is that this needs no DOM. */
const set = (loans) => useLoanStore.setState({ loans });
const get = () => useLoanStore.getState();

describe('loan selectors', () => {
  test('split open, overdue and closed correctly', () => {
    set([
      aLoan({ returnedOn: null, overdue: false }),
      aLoan({ returnedOn: null, overdue: true }),
      aLoan({ returnedOn: '2026-08-22', overdue: false }),
    ]);

    expect(selectOpen(get())).toHaveLength(2);
    expect(selectOverdue(get())).toHaveLength(1);
    expect(selectClosed(get())).toHaveLength(1);
  });

  test('overdue is a strict subset of open — a returned tool is never overdue', () => {
    set([aLoan({ returnedOn: '2026-08-22', overdue: true })]);
    expect(selectOverdue(get())).toHaveLength(0);
    expect(selectClosed(get())).toHaveLength(1);
  });

  test('an empty list yields empty selections rather than throwing', () => {
    set([]);
    expect(selectOpen(get())).toEqual([]);
    expect(selectOverdue(get())).toEqual([]);
  });
});
