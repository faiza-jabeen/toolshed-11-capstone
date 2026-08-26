import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireRole } from '../lib/requireAuth.js';
import { asyncRoute } from '../lib/errors.js';

/** Stretch goal 1: the keeper's dashboard. Aggregated in SQL, one round trip. */
export const stats = Router();

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toISOString().slice(0, 10);
const shift = (iso, by) => new Date(new Date(iso).getTime() + by * 86400_000).toISOString().slice(0, 10);

stats.get('/', requireAuth, requireRole('keeper'), asyncRoute((req, res) => {
  const to = ISO.test(req.query.to ?? '') ? req.query.to : today();
  const from = ISO.test(req.query.from ?? '') ? req.query.from : shift(to, -90);
  const span = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400_000));

  const headline = (f, t) => db.prepare(`
    SELECT COUNT(*) AS loans,
           COUNT(DISTINCT l.user_id) AS members,
           COALESCE(SUM(tl.deposit), 0) AS deposits,
           COALESCE(AVG(julianday(COALESCE(l.returned_on, date('now'))) - julianday(l.borrowed_on)), 0) AS avgDays
    FROM loans l JOIN tools tl ON tl.id = l.tool_id
    WHERE l.borrowed_on BETWEEN ? AND ?
  `).get(f, t);

  const now = headline(from, to);
  const before = headline(shift(from, -span), shift(to, -span));

  res.json({
    data: {
      summary: {
        loans:    { value: now.loans,    previous: before.loans },
        members:  { value: now.members,  previous: before.members },
        deposits: { value: now.deposits, previous: before.deposits },
        avgDays:  { value: Math.round(now.avgDays * 10) / 10, previous: Math.round(before.avgDays * 10) / 10 },
      },

      overTime: db.prepare(`
        SELECT date(l.borrowed_on, 'weekday 1', '-7 days') AS weekStart,
               COUNT(*) AS loans,
               SUM(CASE WHEN l.returned_on IS NOT NULL THEN 1 ELSE 0 END) AS returned
        FROM loans l WHERE l.borrowed_on BETWEEN ? AND ?
        GROUP BY weekStart ORDER BY weekStart
      `).all(from, to),

      /* LEFT JOIN so a shelf nobody touched still appears as a zero bar.
         A missing bar reads as "no data"; a zero bar reads as "nobody borrowed
         this", which is the more interesting fact. */
      byCategory: db.prepare(`
        SELECT t.category, COUNT(l.id) AS loans, COUNT(DISTINCT t.id) AS tools
        FROM tools t
        LEFT JOIN loans l ON l.tool_id = t.id AND l.borrowed_on BETWEEN ? AND ?
        GROUP BY t.category ORDER BY loans DESC
      `).all(from, to),

      shelfState: db.prepare(`
        SELECT
          SUM(CASE WHEN t.status = 'repair' THEN 1 ELSE 0 END) AS inRepair,
          SUM(CASE WHEN t.status = 'in' THEN 1 ELSE 0 END) AS onShelf,
          SUM(CASE WHEN t.status = 'out' AND (o.due_on IS NULL OR o.due_on >= date('now')) THEN 1 ELSE 0 END) AS onLoan,
          SUM(CASE WHEN t.status = 'out' AND o.due_on < date('now') THEN 1 ELSE 0 END) AS overdue
        FROM tools t
        LEFT JOIN loans o ON o.tool_id = t.id AND o.returned_on IS NULL
      `).get(),

      busiest: db.prepare(`
        SELECT t.asset_tag AS assetTag, t.name, t.category, COUNT(l.id) AS loans
        FROM tools t JOIN loans l ON l.tool_id = t.id
        WHERE l.borrowed_on BETWEEN ? AND ?
        GROUP BY t.id ORDER BY loans DESC, t.name LIMIT 8
      `).all(from, to),
    },
    meta: { from, to },
  });
}));
