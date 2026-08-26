import { Router } from 'express';
import { db, toolToApi, loanToApi } from '../db.js';
import { validateTool } from '../lib/toolValidate.js';
import { asyncRoute, conflict, notFound } from '../lib/errors.js';
import { requireAuth, requireRole } from '../lib/requireAuth.js';

export const tools = Router();

/** Reading the catalogue is public; changing it needs a keeper. */
tools.get('/', asyncRoute((req, res) => {
  const { q = '', category = '', status = '' } = req.query;
  const where = []; const params = {};
  if (q) { where.push('(name LIKE :q OR asset_tag LIKE :q OR notes LIKE :q)'); params.q = `%${q}%`; }
  if (category) { where.push('category = :category'); params.category = String(category).toLowerCase(); }
  // An unrecognised status is ignored rather than returning nothing — a typo in
  // a query string should not silently look like an empty catalogue.
  const wanted = String(status).toLowerCase();
  if (['in', 'out', 'repair'].includes(wanted)) { where.push('status = :status'); params.status = wanted; }
  const rows = db.prepare(
    `SELECT * FROM tools ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY asset_tag`,
  ).all(params);
  res.json({ data: rows.map(toolToApi), meta: { count: rows.length } });
}));

/** A single tool, with its current loan if it is out. Public, like the list. */
tools.get('/:id', asyncRoute((req, res) => {
  const row = db.prepare('SELECT * FROM tools WHERE id = ?').get(Number(req.params.id));
  if (!row) throw notFound('Tool');

  const open = db.prepare(`
    SELECT l.*, u.name AS member_name, u.email AS member_email,
           t.name AS tool_name, t.asset_tag, t.category
    FROM loans l JOIN users u ON u.id = l.user_id JOIN tools t ON t.id = l.tool_id
    WHERE l.tool_id = ? AND l.returned_on IS NULL
  `).get(row.id);

  res.json({
    data: {
      ...toolToApi(row),
      // Who has it is keeper-only information; when it is due back is not.
      currentLoan: open ? { dueOn: open.due_on, overdue: open.due_on < new Date().toISOString().slice(0, 10) } : null,
    },
  });
}));

tools.post('/', requireAuth, requireRole('keeper'), asyncRoute((req, res) => {
  const clean = validateTool(req.body);
  try {
    const info = db.prepare(`INSERT INTO tools (asset_tag, name, category, shelf, deposit, status, notes)
      VALUES (@asset_tag, @name, @category, @shelf, @deposit, @status, @notes)`).run(clean);
    res.status(201).json({ data: toolToApi(db.prepare('SELECT * FROM tools WHERE id = ?').get(info.lastInsertRowid)) });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) throw conflict(`Asset tag ${clean.asset_tag} is already in use.`);
    throw err;
  }
}));

tools.patch('/:id', requireAuth, requireRole('keeper'), asyncRoute((req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM tools WHERE id = ?').get(id)) throw notFound('Tool');
  const clean = validateTool(req.body, { partial: true });
  const set = Object.keys(clean).map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE tools SET ${set}, updated_at = datetime('now') WHERE id = @id`).run({ ...clean, id });
  res.json({ data: toolToApi(db.prepare('SELECT * FROM tools WHERE id = ?').get(id)) });
}));

tools.delete('/:id', requireAuth, requireRole('keeper'), asyncRoute((req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM tools WHERE id = ?').get(id);
  if (!row) throw notFound('Tool');

  /* The relationship, enforced. Retiring a tool that is sitting in someone's
     shed would leave a loan pointing at nothing, so the tool has to come home
     first. The FK is ON DELETE RESTRICT as a second line of defence, but the
     409 here is what gives the keeper a message they can act on. */
  const open = db.prepare(
    'SELECT COUNT(*) c FROM loans WHERE tool_id = ? AND returned_on IS NULL',
  ).get(id).c;
  if (open > 0) {
    throw conflict(`${row.asset_tag} is out on loan. Check it back in before retiring it.`);
  }

  const history = db.prepare('SELECT COUNT(*) c FROM loans WHERE tool_id = ?').get(id).c;
  if (history > 0) {
    /* Deleting would take the loan history with it and quietly corrupt every
       figure on the dashboard. Retiring keeps the history and hides the tool. */
    db.prepare("UPDATE tools SET status = 'repair', notes = 'Retired from the catalogue.', updated_at = datetime('now') WHERE id = ?").run(id);
    return res.json({
      data: toolToApi(db.prepare('SELECT * FROM tools WHERE id = ?').get(id)),
      meta: { retired: true, keptFor: history, reason: 'Loan history preserved.' },
    });
  }

  db.prepare('DELETE FROM tools WHERE id = ?').run(id);
  res.json({ data: toolToApi(row), meta: { deleted: true } });
}));

/** A tool's own loan history — the other direction of the relationship. */
tools.get('/:id/loans', requireAuth, requireRole('keeper'), asyncRoute((req, res) => {
  const rows = db.prepare(`
    SELECT l.*, u.name AS member_name, u.email AS member_email,
           t.name AS tool_name, t.asset_tag, t.category
    FROM loans l JOIN users u ON u.id = l.user_id JOIN tools t ON t.id = l.tool_id
    WHERE l.tool_id = ? ORDER BY l.borrowed_on DESC
  `).all(Number(req.params.id));
  res.json({ data: rows.map(loanToApi), meta: { count: rows.length } });
}));
