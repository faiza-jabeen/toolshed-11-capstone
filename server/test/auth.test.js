import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { isolate, buildApp } from './helpers.js';

const cleanup = isolate();
let app;
before(async () => { app = await buildApp(); });
after(() => cleanup());

const CREDS = { name: 'Priya Nair', email: 'priya@toolshed.test', password: 'shed-ladder-9912' };

describe('signup', () => {
  test('creates an account and returns a token plus an httpOnly cookie', async () => {
    const res = await request(app).post('/api/auth/signup').send(CREDS);

    assert.equal(res.status, 201);
    assert.ok(res.body.data.accessToken, 'an access token comes back in the body');
    assert.equal(res.body.data.user.email, CREDS.email);
    assert.equal(res.body.data.user.role, 'member', 'new accounts are members, never keepers');

    const cookie = res.headers['set-cookie'].find((c) => c.startsWith('toolshed_rt='));
    assert.ok(cookie, 'a refresh cookie is set');
    assert.match(cookie, /HttpOnly/, 'the refresh cookie must be HttpOnly');
  });

  test('never returns the password hash', async () => {
    const res = await request(app).post('/api/auth/signup')
      .send({ ...CREDS, email: 'hash-check@toolshed.test' });
    assert.equal(res.status, 201);
    const body = JSON.stringify(res.body);
    assert.ok(!body.includes('password'), 'no password field of any kind in the response');
    assert.ok(!body.includes('$2a$'), 'no bcrypt hash leaked');
  });

  test('rejects a weak password with a message about length', async () => {
    const res = await request(app).post('/api/auth/signup')
      .send({ name: 'Short', email: 'short@toolshed.test', password: 'abc1' });
    assert.equal(res.status, 400);
    assert.match(res.body.error.fields.password, /10 characters/);
  });

  test('rejects a duplicate email regardless of case, with 409', async () => {
    const res = await request(app).post('/api/auth/signup')
      .send({ ...CREDS, email: CREDS.email.toUpperCase() });
    assert.equal(res.status, 409);
  });
});

describe('login', () => {
  test('accepts the right password', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: CREDS.email, password: CREDS.password });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.accessToken);
  });

  test('gives the same message for a wrong password and an unknown email', async () => {
    const wrongPassword = await request(app).post('/api/auth/login')
      .send({ email: CREDS.email, password: 'definitely-wrong-1' });
    const unknownEmail = await request(app).post('/api/auth/login')
      .send({ email: 'nobody@toolshed.test', password: 'definitely-wrong-1' });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.body.error.message, unknownEmail.body.error.message,
      'differing messages would leak which addresses are registered');
  });
});

describe('refresh and logout', () => {
  test('a refresh token is single use — replaying it fails', async () => {
    const login = await request(app).post('/api/auth/login')
      .send({ email: CREDS.email, password: CREDS.password });
    const cookie = login.headers['set-cookie'];

    const first = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    assert.equal(first.status, 200, 'the first refresh works');
    assert.ok(first.body.data.accessToken);

    const replay = await request(app).post('/api/auth/refresh').set('Cookie', cookie);
    assert.equal(replay.status, 401, 'the same token must not work twice — it rotates');
  });

  test('logout revokes the session server-side', async () => {
    const login = await request(app).post('/api/auth/login')
      .send({ email: CREDS.email, password: CREDS.password });
    const cookie = login.headers['set-cookie'];

    assert.equal((await request(app).post('/api/auth/logout').set('Cookie', cookie)).status, 200);
    assert.equal((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status, 401,
      'a copied cookie is useless after logout');
  });

  test('a tampered token is rejected', async () => {
    const res = await request(app).post('/api/auth/refresh')
      .set('Cookie', ['toolshed_rt=eyJhbGciOiJIUzI1NiJ9.tampered.signature']);
    assert.equal(res.status, 401);
  });
});

describe('the auth guard', () => {
  test('a request with no Authorization header is 401', async () => {
    const res = await request(app).post('/api/tools').send({});
    assert.equal(res.status, 401);
    assert.match(res.body.error.message, /token/i);
  });

  test('a malformed Authorization header is 401, not a 500', async () => {
    const res = await request(app).post('/api/tools')
      .set('Authorization', 'Basic bm90LWEtand0').send({});
    assert.equal(res.status, 401);
  });

  test('a syntactically valid but forged token is 401', async () => {
    const forged = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6ImtlZXBlciJ9.nope';
    const res = await request(app).post('/api/tools')
      .set('Authorization', `Bearer ${forged}`).send({});
    assert.equal(res.status, 401, 'signing is what matters, not shape');
  });
});
