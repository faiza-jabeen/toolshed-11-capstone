import { Router } from 'express';
import { db, loanToApi, toolToApi } from '../db.js';
import { validateLoan } from '../lib/loanValidate.js';
import { requireAuth, requireRole } from '../lib/requireAuth.js';
import { asyncRoute, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';

export const loans = Router();

/* The join every read needs — one place, so the shape never drifts. */
const SELECT = `
  SELECT l.*, t.name AS tool_name, t.asset_tag, t.category,
         u.name AS member_name, u.email AS member_email
  FROM loans l
  JOIN tools t ON t.id = l.tool_id
  JOIN users u ON u.id = l.user_id
`;

/* ---- READ many ----------------------------------------------------------
   A member sees only their own loans. A keeper sees everyone's. The scoping
   is applied server-side from the token, never from a query parameter — a
   ?userId= filter would let anyone read anyone's borrowing history.          */
loans.get('/', requireAuth, asyncRoute((req, res) => {
  const mine = req.user.role !== 'keeper' || req.query.scope === 'mine';
  const open = req.query.status === 'open';
  const overdue = req.query.status === 'overdue';

  const where = [];
  const params = {};
  if (mine) { where.push('l.user_id = @userId'); params.userId = req.user.id; }
  if (open || overdue) where.push('l.returned_on IS NULL');
  if (overdue) where.push("l.due_on < date('now')");

  const rows = db.prepare(`
    ${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY l.returned_on IS NOT NULL, l.due_on
  `).all(params);

  res.json({ data: rows.map(loanToApi), meta: { count: rows.length, scope: mine ? 'mine' : 'all' } });
}));

/* ---- READ one ----------------------------------------------------------- */
loans.get('/:id', requireAuth, asyncRoute((req, res) => {
  const row = db.prepare(`${SELECT} WHERE l.id = ?`).get(Number(req.params.id));
  if (!row) throw notFound('Loan');
  if (row.user_id !== req.user.id && req.user.role !== 'keeper') throw forbidden('That is not your loan.');
  res.json({ data: loanToApi(row) });
}));

/* ---- CREATE: borrow a tool ---------------------------------------------
   The whole thing runs in a transaction. Checking that a tool is free and
   then marking it out in two separate statements is a race: two members can
   both pass the check. A transaction plus the partial unique index means the
   second one loses, cleanly.                                                 */
loans.post('/', requireAuth, asyncRoute((req, res) => {
  const clean = validateLoan(req.body, { role: req.user.role });

  const borrow = db.transaction(() => {
    const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(clean.tool_id);
    if (!tool) throw notFound('Tool');
    if (tool.status === 'repair') throw conflict(`${tool.asset_tag} is in for repair and cannot go out.`);
    if (tool.status === 'out') throw conflict(`${tool.asset_tag} is already out with someone else.`);

    const openCount = db.prepare(
      'SELECT COUNT(*) c FROM loans WHERE user_id = ? AND returned_on IS NULL',
    ).get(req.user.id).c;
    const allowance = req.user.role === 'keeper' ? 6 : 3;
    if (openCount >= allowance) {
      throw conflict(`You already have ${openCount} tools out. The limit is ${allowance} — bring one back first.`);
    }

    const info = db.prepare(
      'INSERT INTO loans (tool_id, user_id, due_on, note) VALUES (@tool_id, @user_id, @due_on, @note)',
    ).run({ ...clean, user_id: req.user.id });

    db.prepare("UPDATE tools SET status = 'out', updated_at = datetime('now') WHERE id = ?").run(clean.tool_id);
    return info.lastInsertRowid;
  });

  let id;
  try {
    id = borrow();
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) throw conflict('That tool was just borrowed by someone else.');
    throw err;
  }

  res.status(201).json({ data: loanToApi(db.prepare(`${SELECT} WHERE l.id = ?`).get(id)) });
}));

/* ---- UPDATE: extend a loan, or return it -------------------------------- */
loans.patch('/:id', requireAuth, asyncRoute((req, res) => {
  const id = Number(req.params.id);
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(id);
  if (!loan) throw notFound('Loan');

  const isOwner = loan.user_id === req.user.id;
  const isKeeper = req.user.role === 'keeper';
  if (!isOwner && !isKeeper) throw forbidden('That is not your loan.');

  /* Returning a tool is a keeper action: somebody has to physically look at
     the tool and confirm it came back in one piece. */
  if (req.body.returned === true) {
    if (!isKeeper) throw forbidden('Only a keeper can check a tool back in.');
    if (loan.returned_on) throw conflict('That loan was already closed.');

    db.transaction(() => {
      db.prepare("UPDATE loans SET returned_on = date('now') WHERE id = ?").run(id);
      db.prepare("UPDATE tools SET status = 'in', updated_at = datetime('now') WHERE id = ?").run(loan.tool_id);
    })();

    return res.json({ data: loanToApi(db.prepare(`${SELECT} WHERE l.id = ?`).get(id)) });
  }

  if (loan.returned_on) throw conflict('That loan is closed — it cannot be changed.');

  const clean = validateLoan({ toolId: loan.tool_id, ...req.body }, { role: req.user.role });
  db.prepare('UPDATE loans SET due_on = @due_on, note = @note WHERE id = @id')
    .run({ due_on: clean.due_on, note: clean.note, id });

  res.json({ data: loanToApi(db.prepare(`${SELECT} WHERE l.id = ?`).get(id)) });
}));

/* ---- DELETE: cancel a loan raised in error ------------------------------ */
loans.delete('/:id', requireAuth, requireRole('keeper'), asyncRoute((req, res) => {
  const id = Number(req.params.id);
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(id);
  if (!loan) throw notFound('Loan');

  db.transaction(() => {
    db.prepare('DELETE FROM loans WHERE id = ?').run(id);
    if (!loan.returned_on) {
      db.prepare("UPDATE tools SET status = 'in', updated_at = datetime('now') WHERE id = ?").run(loan.tool_id);
    }
  })();

  res.json({ data: loanToApi(loan), meta: { deleted: true } });
}));
