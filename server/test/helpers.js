import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Every test file gets its own throwaway SQLite file and its own secrets.
 * These must be set BEFORE anything imports db.js or tokens.js, because both
 * read process.env at module load — hence the dynamic imports below.
 */
export function isolate() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'toolshed-test-'));
  process.env.DATABASE_PATH = path.join(dir, 'test.db');
  process.env.ACCESS_TOKEN_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.REFRESH_TOKEN_SECRET = crypto.randomBytes(32).toString('hex');
  process.env.ACCESS_TOKEN_TTL = '15m';
  process.env.NODE_ENV = 'test';
  return () => fs.rmSync(dir, { recursive: true, force: true });
}

export async function buildApp() {
  const { createApp } = await import('../src/index.js');
  return createApp();
}

/** Signs a user up and hands back the token, so tests read as intent. */
export async function signUp(request, app, {
  email = `u${Math.random().toString(36).slice(2)}@example.test`,
  name = 'Test Person',
  password = 'shed-ladder-9912',
  role = 'member',
} = {}) {
  const res = await request(app).post('/api/auth/signup').send({ name, email, password });
  if (role === 'keeper') {
    const { db } = await import('../src/db.js');
    db.prepare('UPDATE users SET role = ? WHERE email = ?').run('keeper', email);
    const again = await request(app).post('/api/auth/login').send({ email, password });
    return { token: again.body.data.accessToken, user: again.body.data.user, email, password };
  }
  return { token: res.body.data.accessToken, user: res.body.data.user, email, password };
}

export const asKeeper = (req, token) => req.set('Authorization', `Bearer ${token}`);

export const validTool = (over = {}) => ({
  assetTag: 'TS-0900', name: 'Test bench vice', category: 'hand',
  shelf: 'D1', deposit: 10, status: 'in', notes: 'For tests.', ...over,
});
