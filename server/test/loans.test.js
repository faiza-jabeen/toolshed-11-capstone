import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { isolate, buildApp, signUp, validTool } from './helpers.js';

const cleanup = isolate();
let app, keeper, member, other, toolId;

const auth = (r, token) => r.set('Authorization', `Bearer ${token}`);

before(async () => {
  app = await buildApp();
  keeper = await signUp(request, app, { email: 'keeper@toolshed.test', role: 'keeper' });
  member = await signUp(request, app, { email: 'member@toolshed.test' });
  other  = await signUp(request, app, { email: 'other@toolshed.test' });

  const res = await auth(request(app).post('/api/tools'), keeper.token)
    .send(validTool({ assetTag: 'TS-0700', name: 'Test drill' }));
  toolId = res.body.data.id;
});
after(() => cleanup());

describe('borrowing', () => {
  let loanId;

  test('a member can borrow a free tool, and the tool goes out', async () => {
    const res = await auth(request(app).post('/api/loans'), member.token).send({ toolId });
    assert.equal(res.status, 201);
    assert.equal(res.body.data.toolId, toolId);
    assert.ok(res.body.data.dueOn, 'a due date is defaulted, not left blank');
    loanId = res.body.data.id;

    const tool = await request(app).get(`/api/tools/${toolId}`);
    assert.equal(tool.body.data.status, 'out', 'borrowing must flip the tool status');
  });

  test('the same tool cannot be borrowed twice', async () => {
    const res = await auth(request(app).post('/api/loans'), other.token).send({ toolId });
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /already out/);
  });

  test('a tool that is out cannot be retired', async () => {
    const res = await auth(request(app).delete(`/api/tools/${toolId}`), keeper.token);
    assert.equal(res.status, 409);
    assert.match(res.body.error.message, /check it back in/i);
  });

  test('a return date beyond the loan limit is rejected', async () => {
    const res = await auth(request(app).patch(`/api/loans/${loanId}`), member.token)
      .send({ dueOn: '2030-01-01' });
    assert.equal(res.status, 400);
    assert.match(res.body.error.fields.dueOn, /7 days/);
  });

  test('a return date in the past is rejected', async () => {
    const res = await auth(request(app).patch(`/api/loans/${loanId}`), member.token)
      .send({ dueOn: '2020-01-01' });
    assert.equal(res.status, 400);
  });

  test('a member cannot check their own tool back in', async () => {
    const res = await auth(request(app).patch(`/api/loans/${loanId}`), member.token)
      .send({ returned: true });
    assert.equal(res.status, 403);
    assert.match(res.body.error.message, /keeper/);
  });

  test('a keeper checks it in, and the tool returns to the shelf', async () => {
    const res = await auth(request(app).patch(`/api/loans/${loanId}`), keeper.token)
      .send({ returned: true });
    assert.equal(res.status, 200);
    assert.ok(res.body.data.returnedOn);

    const tool = await request(app).get(`/api/tools/${toolId}`);
    assert.equal(tool.body.data.status, 'in');
  });

  test('checking the same loan in twice is a 409', async () => {
    const res = await auth(request(app).patch(`/api/loans/${loanId}`), keeper.token)
      .send({ returned: true });
    assert.equal(res.status, 409);
  });
});

describe('visibility', () => {
  test('a member sees only their own loans', async () => {
    const res = await auth(request(app).get('/api/loans'), member.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.meta.scope, 'mine');
    assert.ok(res.body.data.every((l) => l.userId === member.user.id));
  });

  test('a member cannot read someone else\'s loan by guessing the id', async () => {
    const mine = (await auth(request(app).get('/api/loans'), member.token)).body.data[0];
    const res = await auth(request(app).get(`/api/loans/${mine.id}`), other.token);
    assert.equal(res.status, 403);
  });

  test('a keeper sees everyone, with the member joined on', async () => {
    const res = await auth(request(app).get('/api/loans'), keeper.token);
    assert.equal(res.body.meta.scope, 'all');
    assert.ok(res.body.data[0].member?.name, 'keeper view joins the borrower');
    assert.ok(res.body.data[0].tool?.assetTag, 'and the tool');
  });

  test('anonymous access is refused', async () => {
    assert.equal((await request(app).get('/api/loans')).status, 401);
  });
});

describe('the borrowing allowance', () => {
  test('a member is stopped at three open loans', async () => {
    const tags = ['TS-0710', 'TS-0711', 'TS-0712', 'TS-0713'];
    const ids = [];
    for (const assetTag of tags) {
      const t = await auth(request(app).post('/api/tools'), keeper.token)
        .send(validTool({ assetTag, name: `Spare ${assetTag}` }));
      ids.push(t.body.data.id);
    }

    const codes = [];
    for (const id of ids) {
      codes.push((await auth(request(app).post('/api/loans'), other.token).send({ toolId: id })).status);
    }

    assert.deepEqual(codes, [201, 201, 201, 409], 'the fourth must be refused');
  });
});

describe('retiring a tool with history', () => {
  test('keeps the loan history instead of deleting it', async () => {
    const res = await auth(request(app).delete(`/api/tools/${toolId}`), keeper.token);
    assert.equal(res.status, 200);
    assert.equal(res.body.meta.retired, true);
    assert.ok(res.body.meta.keptFor >= 1, 'it reports how much history it preserved');

    // The row survives, so dashboard figures stay honest.
    const history = await auth(request(app).get(`/api/tools/${toolId}/loans`), keeper.token);
    assert.ok(history.body.data.length >= 1);
  });
});

describe('the dashboard', () => {
  test('is keeper-only', async () => {
    assert.equal((await auth(request(app).get('/api/stats'), member.token)).status, 403);
  });

  test('returns every dataset the page needs in one request', async () => {
    const res = await auth(request(app).get('/api/stats'), keeper.token);
    assert.equal(res.status, 200);
    for (const key of ['summary', 'overTime', 'byCategory', 'shelfState', 'busiest']) {
      assert.ok(key in res.body.data, `missing ${key}`);
    }
    assert.ok('previous' in res.body.data.summary.loans, 'each headline carries its comparison');
  });
});
