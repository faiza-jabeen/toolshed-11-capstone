import { badRequest } from './errors.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateSignup(body = {}) {
  const fields = {};
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  if (!name) fields.name = 'Tell us what to call you.';
  else if (name.length < 2) fields.name = 'That is a little short for a name.';
  else if (name.length > 60) fields.name = 'Keep it under 60 characters.';

  if (!email) fields.email = 'Email address is required.';
  else if (!EMAIL.test(email)) fields.email = 'That does not look like an email address.';
  else if (email.length > 254) fields.email = 'That email address is too long.';

  const pw = passwordProblem(password);
  if (pw) fields.password = pw;

  if (Object.keys(fields).length) throw badRequest('Check the highlighted fields.', fields);
  return { name, email, password };
}

export function validateLogin(body = {}) {
  const fields = {};
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');

  if (!email) fields.email = 'Email address is required.';
  else if (!EMAIL.test(email)) fields.email = 'That does not look like an email address.';
  if (!password) fields.password = 'Password is required.';

  if (Object.keys(fields).length) throw badRequest('Check the highlighted fields.', fields);
  return { email, password };
}

/**
 * Length first, because length is what actually resists offline cracking.
 * The character-class rules are here because the brief asked for password
 * rules, and they are kept mild so they push people toward longer passwords
 * rather than toward Passw0rd!.
 */
export function passwordProblem(password) {
  if (!password) return 'Password is required.';
  if (password.length < 10) return 'Use at least 10 characters — length matters more than symbols.';
  if (password.length > 200) return 'That is longer than 200 characters.';
  if (!/[a-z]/i.test(password)) return 'Include at least one letter.';
  if (!/\d/.test(password)) return 'Include at least one number.';
  if (/^(.)\1+$/.test(password)) return 'That is the same character repeated.';
  if (COMMON.has(password.toLowerCase())) return 'That password appears on every leaked-password list.';
  return '';
}

const COMMON = new Set([
  'password123', '1234567890', 'qwertyuiop', 'letmein123',
  'password1234', 'iloveyou123', 'admin12345', 'welcome123',
]);
