import { badRequest } from './errors.js';

export const CATEGORIES = ['power', 'garden', 'decorate', 'access', 'measure', 'hand'];
export const STATUSES = ['in', 'out', 'repair'];

/**
 * Hand-rolled so the rules are visible rather than hidden in a schema library.
 * Returns the cleaned object; throws a 400 carrying per-field messages.
 * `partial: true` is used by PATCH — absent keys are simply not checked.
 */
export function validateTool(body = {}, { partial = false } = {}) {
  const fields = {};
  const out = {};

  const has = (key) => body[key] !== undefined && body[key] !== null;
  const required = (key, label) => {
    if (!partial && !has(key)) { fields[key] = `${label} is required.`; return false; }
    return has(key);
  };

  if (required('name', 'Tool name')) {
    const name = String(body.name).trim();
    if (name.length < 2) fields.name = 'Tool name needs at least 2 characters.';
    else if (name.length > 80) fields.name = 'Keep the tool name under 80 characters.';
    else out.name = name;
  }

  if (required('assetTag', 'Asset tag')) {
    const tag = String(body.assetTag).trim().toUpperCase();
    if (!/^TS-\d{4}$/.test(tag)) fields.assetTag = 'Asset tags look like TS-0142.';
    else out.asset_tag = tag;
  }

  if (required('category', 'Category')) {
    const cat = String(body.category).trim().toLowerCase();
    if (!CATEGORIES.includes(cat)) fields.category = `Pick one of: ${CATEGORIES.join(', ')}.`;
    else out.category = cat;
  }

  if (required('shelf', 'Shelf')) {
    const shelf = String(body.shelf).trim();
    if (!shelf) fields.shelf = 'Shelf is required.';
    else if (shelf.length > 12) fields.shelf = 'Shelf labels are short — 12 characters at most.';
    else out.shelf = shelf;
  }

  if (has('deposit')) {
    const deposit = Number(body.deposit);
    if (!Number.isFinite(deposit)) fields.deposit = 'Deposit must be a number.';
    else if (deposit < 0) fields.deposit = 'Deposit cannot be negative.';
    else if (deposit > 500) fields.deposit = 'Deposits over £500 need a trustee to approve them.';
    else out.deposit = Math.round(deposit);
  } else if (!partial) {
    out.deposit = 0;
  }

  if (has('status')) {
    const status = String(body.status).trim().toLowerCase();
    if (!STATUSES.includes(status)) fields.status = `Status must be one of: ${STATUSES.join(', ')}.`;
    else out.status = status;
  } else if (!partial) {
    out.status = 'in';
  }

  if (has('notes')) {
    const notes = String(body.notes).trim();
    if (notes.length > 400) fields.notes = 'Notes are capped at 400 characters.';
    else out.notes = notes;
  } else if (!partial) {
    out.notes = '';
  }

  if (Object.keys(fields).length) {
    throw badRequest('Some fields need fixing before this can be saved.', fields);
  }
  if (partial && Object.keys(out).length === 0) {
    throw badRequest('Nothing to update — send at least one field.');
  }
  return out;
}
