import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { isolate, buildApp, signUp, validTool } from './helpers.js';

const cleanup = isolate();
let app, keeper, member;

before(async () => {
  app = await buildApp();
  keeper = await signUp(request, app, { email: 'keeper@toolshed.test', role: 'keeper' });
  member = await signUp(request, app, { email: 'member@toolshed.test' });
});
after(() => cleanup());

const auth = (r, token) => r.set('Authorization', `Bearer ${token}`);

describe('GET /api/tools', () => {
  test('is public and returns an envelope with a count', async () => {
    const res = await request(app).get('/api/tools');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.equal(typeof res.body.meta.count, 'number');
  });

  test('filters by category', async () => {
    await auth(request(app).post('/api/tools'), keeper.token)
      .send(validTool({ assetTag: 'TS-0801', category: 'garden', name: 'Test spade' }));
    await auth(request(app).post('/api/tools'), keeper.token)
      .send(validTool({ assetTag: 'TS-0802', category: 'power', name: 'Test drill' }));

    const res = await request(app).get('/api/tools?category=garden');
    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 1);
    assert.ok(res.body.data.every((t) => t.category === 'garden'),
      'every returned tool should be in the requested category');
  });

  test('search matches the asset tag as well as the name', async () => {
    const res = await request(app).get('/api/tools?q=TS-0801');
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].name, 'Test spade');
  });
});

describe('POST /api/tools — the happy path', () => {
  test('a keeper can create a tool and gets 201 with the stored row', async () => {
    const res = await auth(request(app).post('/api/tools'), keeper.token)
      .send(validTool({ assetTag: 'TS-0810', name: 'Test mallet' }));

    assert.equal(res.status, 201);
    assert.equal(res.body.data.assetTag, 'TS-0810');
    assert.equal(res.body.data.status, 'in', 'status should default to in');
    assert.ok(res.body.data.id, 'the response carries the new id');
    assert.ok(res.body.data.createdAt);
  });

  test('the asset tag is normalised to upper case', async () => {
    const res = await auth(request(app).post('/api/tools'), keeper.token)
      .send(validTool({ assetTag: 'ts-0811' }));
    assert.equal(res.body.data.assetTag, 'TS-0811');
  });
});

describe('POST /api/tools — failure cases', () => {
  test('rejects an anonymous write with 401', async () => {
    const res = await request(app).post('/api/tools').send(validTool({ assetTag: 'TS-0820' }));
    assert.equal(res.status, 401);
  });

  test('rejects a member write with 403 naming the required role', async () => {
    const res = await auth(request(app).post('/api/tools'), member.token)
      .send(validTool({ assetTag: 'TS-0821' }));
    assert.equal(res.status, 403);
    assert.match(res.body.error.message, /keeper/);
  });

  test('returns every invalid field at once, not just the first', async () => {
    const res = await auth(request(app).post('/api/tools'), keeper.token)
      .send({ assetTag: 'nope', name: 'x', category: 'spaceship', shelf: '', deposit: -5 });

    assert.equal(res.status, 400);
    const fields = Object.keys(res.body.error.fields);
    for (const key of ['assetTag', 'name', 'category', 'shelf', 'deposit']) {
      assert.ok(fields.includes(key), `expected a message for ${key}`);
    }
  });

  test('rejects a duplicate asset tag with 409, not 400', async () => {
    await auth(request(app).post('/api/tools'), keeper.token).send(validTool({ assetTag: 'TS-0830' }));
    const res = await auth(request(app).post('/api/tools'), keeper.token).send(validTool({ assetTag: 'TS-0830' }));
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /TS-0830/);
  });

  test('rejects a deposit above the trustee ceiling', async () => {
    const res = await auth(request(app).post('/api/tools'), keeper.token)
      .send(validTool({ assetTag: 'TS-0840', deposit: 9000 }));
    assert.equal(res.status, 400);
    assert.match(res.body.error.fields.deposit, /trustee/);
  });
});

describe('PATCH and DELETE', () => {
  let id;
  before(async () => {
    const res = await auth(request(app).post('/api/tools'), keeper.token)
      .send(validTool({ assetTag: 'TS-0850', name: 'Test chisel' }));
    id = res.body.data.id;
  });

  test('a partial update changes only what was sent', async () => {
    const res = await auth(request(app).patch(`/api/tools/${id}`), keeper.token).send({ status: 'out' });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'out');
    assert.equal(res.body.data.name, 'Test chisel', 'unsent fields must be left alone');
  });

  test('an empty patch body is a 400, not a silent no-op', async () => {
    const res = await auth(request(app).patch(`/api/tools/${id}`), keeper.token).send({});
    assert.equal(res.status, 400);
  });

  test('patching a missing id is 404', async () => {
    const res = await auth(request(app).patch('/api/tools/999999'), keeper.token).send({ status: 'in' });
    assert.equal(res.status, 404);
  });

  test('delete removes it, and fetching it afterwards is 404', async () => {
    assert.equal((await auth(request(app).delete(`/api/tools/${id}`), keeper.token)).status, 200);
    assert.equal((await request(app).get(`/api/tools/${id}`)).status, 404);
  });
});
