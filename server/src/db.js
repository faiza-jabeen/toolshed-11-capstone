import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const file = process.env.DATABASE_PATH || './data/toolshed.db';
fs.mkdirSync(path.dirname(file), { recursive: true });

export const db = new Database(file);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  /* ---- people ---------------------------------------------------------- */
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member','keeper')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

  /* ---- resource 1: tools ------------------------------------------------ */
  CREATE TABLE IF NOT EXISTS tools (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_tag  TEXT NOT NULL UNIQUE,
    name       TEXT NOT NULL,
    category   TEXT NOT NULL,
    shelf      TEXT NOT NULL,
    deposit    INTEGER NOT NULL DEFAULT 0,
    status     TEXT NOT NULL DEFAULT 'in' CHECK (status IN ('in','out','repair')),
    notes      TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category);
  CREATE INDEX IF NOT EXISTS idx_tools_status   ON tools(status);

  /* ---- resource 2: loans ------------------------------------------------
     A loan belongs to a tool AND to a member. That relationship is what makes
     "two related resources" mean something: a tool that is out cannot be
     retired, and returning a loan is what puts the tool back on the shelf.   */
  CREATE TABLE IF NOT EXISTS loans (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id     INTEGER NOT NULL REFERENCES tools(id) ON DELETE RESTRICT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    borrowed_on TEXT NOT NULL DEFAULT (date('now')),
    due_on      TEXT NOT NULL,
    returned_on TEXT,
    note        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);
  CREATE INDEX IF NOT EXISTS idx_loans_tool ON loans(tool_id);

  /* At most one OPEN loan per tool — enforced by the database rather than by
     hoping the application always checks first. Two keepers clicking "lend"
     at the same moment cannot both succeed. */
  CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_loan
    ON loans(tool_id) WHERE returned_on IS NULL;
`);

const todayIso = () => new Date().toISOString().slice(0, 10);

export const toolToApi = (r) => r && ({
  id: r.id, assetTag: r.asset_tag, name: r.name, category: r.category,
  shelf: r.shelf, deposit: r.deposit, status: r.status, notes: r.notes,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const loanToApi = (r) => r && ({
  id: r.id,
  toolId: r.tool_id,
  userId: r.user_id,
  borrowedOn: r.borrowed_on,
  dueOn: r.due_on,
  returnedOn: r.returned_on,
  note: r.note,
  overdue: !r.returned_on && r.due_on < todayIso(),
  // Joined columns, present only when the query asked for them.
  tool: r.tool_name ? { assetTag: r.asset_tag, name: r.tool_name, category: r.category } : undefined,
  member: r.member_name ? { id: r.user_id, name: r.member_name, email: r.member_email } : undefined,
});

/** Never let a password hash out of the data layer by accident. */
export const publicUser = (r) => r && ({
  id: r.id, email: r.email, name: r.name, role: r.role, createdAt: r.created_at,
});
