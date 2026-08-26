import { badRequest } from './errors.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toISOString().slice(0, 10);
const plus = (days) => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);

/** Loan length depends on membership tier — workshop members get a fortnight. */
export const MAX_LOAN_DAYS = { member: 7, keeper: 14 };

export function validateLoan(body = {}, { role = 'member' } = {}) {
  const fields = {};
  const out = {};

  const toolId = Number(body.toolId);
  if (!Number.isInteger(toolId) || toolId < 1) fields.toolId = 'Pick a tool to borrow.';
  else out.tool_id = toolId;

  const limit = MAX_LOAN_DAYS[role] ?? 7;
  const dueOn = String(body.dueOn ?? '').trim();

  if (!dueOn) {
    out.due_on = plus(limit);                       // sensible default, not an error
  } else if (!ISO.test(dueOn)) {
    fields.dueOn = 'Use the date picker, or type YYYY-MM-DD.';
  } else if (dueOn <= today()) {
    fields.dueOn = 'The return date has to be in the future.';
  } else if (dueOn > plus(limit)) {
    fields.dueOn = `Loans run to ${limit} days — that would be longer.`;
  } else {
    out.due_on = dueOn;
  }

  const note = String(body.note ?? '').trim();
  if (note.length > 200) fields.note = `${note.length} characters — trim it to 200.`;
  else out.note = note;

  if (Object.keys(fields).length) throw badRequest('Check the highlighted fields.', fields);
  return out;
}
