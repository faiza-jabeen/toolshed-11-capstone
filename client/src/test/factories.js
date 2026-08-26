let n = 0;
export const aTool = (over = {}) => ({
  id: ++n, assetTag: `TS-0${100 + n}`, name: 'Random orbital sander',
  category: 'power', shelf: 'B4', deposit: 10, status: 'in',
  notes: 'Bring your own discs.', createdAt: '2026-01-01 10:00:00',
  updatedAt: '2026-01-01 10:00:00', ...over,
});

export const aLoan = (over = {}) => ({
  id: ++n, toolId: 1, userId: 2,
  borrowedOn: '2026-08-20', dueOn: '2026-08-27', returnedOn: null,
  note: '', overdue: false,
  tool: { assetTag: 'TS-0104', name: 'SDS hammer drill', category: 'power' },
  member: { id: 2, name: 'Sam Okoro', email: 'sam@toolshed.test' },
  ...over,
});

export const aKeeper = (over = {}) => ({ id: 1, name: 'Ada Whitfield', email: 'ada@toolshed.test', role: 'keeper', ...over });
export const aMember = (over = {}) => ({ id: 2, name: 'Sam Okoro', email: 'sam@toolshed.test', role: 'member', ...over });
