import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';

const ACCESS_SECRET = () => required('ACCESS_TOKEN_SECRET');
const REFRESH_SECRET = () => required('REFRESH_TOKEN_SECRET');
const ACCESS_TTL = () => process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_DAYS = () => Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7);

export const REFRESH_COOKIE = 'toolshed_rt';

function required(name) {
  const value = process.env[name];
  // Failing loudly at first use beats silently signing tokens with "undefined".
  if (!value || value.startsWith('replace-me')) {
    throw new Error(`${name} is not set. Copy .env.example to .env and generate real secrets.`);
  }
  return value;
}

/** Short-lived, sent in the JSON body, held only in the client's memory. */
export function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), email: user.email, name: user.name, role: user.role },
    ACCESS_SECRET(),
    { expiresIn: ACCESS_TTL(), issuer: 'toolshed' },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET(), { issuer: 'toolshed' });
}

/**
 * Long-lived, sent only as an httpOnly cookie, and recorded in the database as
 * a SHA-256 hash so it can be revoked and so a database leak is not a session leak.
 */
export function issueRefreshToken(userId) {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: String(userId), jti }, REFRESH_SECRET(), {
    expiresIn: `${REFRESH_DAYS()}d`, issuer: 'toolshed',
  });
  const expires = new Date(Date.now() + REFRESH_DAYS() * 86400_000);

  db.prepare(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`)
    .run(userId, hash(token), expires.toISOString());

  return { token, expires };
}

/** Verifies signature *and* that the row is still live. Then rotates it. */
export function rotateRefreshToken(rawToken) {
  let payload;
  try {
    payload = jwt.verify(rawToken, REFRESH_SECRET(), { issuer: 'toolshed' });
  } catch {
    return null;
  }

  const row = db.prepare(`
    SELECT * FROM refresh_tokens
    WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > datetime('now')
  `).get(hash(rawToken));

  if (!row) return null;

  db.prepare(`UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE id = ?`).run(row.id);
  const next = issueRefreshToken(row.user_id);
  return { userId: row.user_id, ...next, jti: payload.jti };
}

export function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  db.prepare(`UPDATE refresh_tokens SET revoked_at = datetime('now') WHERE token_hash = ?`)
    .run(hash(rawToken));
}

export function revokeAllForUser(userId) {
  db.prepare(`UPDATE refresh_tokens SET revoked_at = datetime('now')
              WHERE user_id = ? AND revoked_at IS NULL`).run(userId);
}

/** Clearing must repeat the same path/sameSite/secure or the browser keeps the cookie. */
export function clearCookieOptions() {
  const { expires, ...rest } = cookieOptions(new Date(0));
  return rest;
}

export function cookieOptions(expires) {
  const production = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,                          // JavaScript cannot read it — XSS cannot steal it
    secure: production,                      // HTTPS only in production
    sameSite: production ? 'none' : 'lax',   // 'none' when API and client are on different origins
    path: '/api/auth',                       // sent only to the auth endpoints, not every request
    expires,
  };
}

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');
