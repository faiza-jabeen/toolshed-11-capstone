import { verifyAccessToken } from './tokens.js';
import { unauthorized, forbidden } from './errors.js';
import { db, publicUser } from '../db.js';

/** Gate for any route that needs a signed-in user. */
export function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(unauthorized('Missing access token.'));
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    // The client tells these apart: 'expired' triggers a silent refresh,
    // anything else means sign in again.
    return next(unauthorized(err.name === 'TokenExpiredError'
      ? 'Access token expired.'
      : 'Access token is not valid.'));
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(payload.sub));
  if (!user) return next(unauthorized('That account no longer exists.'));

  req.user = publicUser(user);
  next();
}

/** Coarse role check. Task 11 refines this into real permissions. */
export const requireRole = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(forbidden(`This area is for ${roles.join(' or ')} accounts.`));
