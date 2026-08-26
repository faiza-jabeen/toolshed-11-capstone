import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, publicUser } from '../db.js';
import { validateSignup, validateLogin } from '../lib/validate.js';
import { asyncRoute, conflict, unauthorized } from '../lib/errors.js';
import {
  REFRESH_COOKIE, signAccessToken, issueRefreshToken, rotateRefreshToken,
  revokeRefreshToken, cookieOptions, clearCookieOptions,
} from '../lib/tokens.js';
import { requireAuth } from '../lib/requireAuth.js';

export const auth = Router();

const COST = 12;   // ~250ms on a modern server: slow enough to matter, fast enough to log in

/* ---- signup ------------------------------------------------------------- */
auth.post('/signup', asyncRoute(async (req, res) => {
  const { name, email, password } = validateSignup(req.body);

  const taken = db.prepare('SELECT 1 FROM users WHERE email = ?').get(email);
  if (taken) throw conflict('That email address already has an account. Try signing in.');

  const password_hash = await bcrypt.hash(password, COST);
  const info = db.prepare(
    'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
  ).run(email, name, password_hash);

  const user = publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid));
  res.status(201).json(startSession(res, user));
}));

/* ---- login -------------------------------------------------------------- */
auth.post('/login', asyncRoute(async (req, res) => {
  const { email, password } = validateLogin(req.body);
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  // Compare against a dummy hash when the account does not exist, so the
  // response time does not reveal which addresses are registered.
  const hash = row?.password_hash ?? DUMMY_HASH;
  const ok = await bcrypt.compare(password, hash);

  if (!row || !ok) throw unauthorized('Email or password is wrong.');

  res.json(startSession(res, publicUser(row)));
}));

/* ---- silent refresh ----------------------------------------------------- */
auth.post('/refresh', asyncRoute((req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) throw unauthorized('No session to refresh.');

  const rotated = rotateRefreshToken(raw);
  if (!rotated) {
    res.clearCookie(REFRESH_COOKIE, clearCookieOptions());
    throw unauthorized('Session expired. Sign in again.');
  }

  const user = publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(rotated.userId));
  res.cookie(REFRESH_COOKIE, rotated.token, cookieOptions(rotated.expires));
  res.json({ data: { user, accessToken: signAccessToken(user) } });
}));

/* ---- who am I ----------------------------------------------------------- */
auth.get('/me', requireAuth, (req, res) => res.json({ data: { user: req.user } }));

/* ---- logout ------------------------------------------------------------- */
auth.post('/logout', asyncRoute((req, res) => {
  revokeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, clearCookieOptions());
  res.status(200).json({ data: { ok: true } });
}));

function startSession(res, user) {
  const { token, expires } = issueRefreshToken(user.id);
  res.cookie(REFRESH_COOKIE, token, cookieOptions(expires));
  return { data: { user, accessToken: signAccessToken(user) } };
}

// bcrypt hash of a string nobody will ever submit; used purely for timing parity.
const DUMMY_HASH = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.7O8vHTLJPBqXK8h8kzL1qVXqZ0Jt1lC';
