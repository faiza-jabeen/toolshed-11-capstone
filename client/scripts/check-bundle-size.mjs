import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * Budgets, enforced in CI. A budget nobody enforces is a wish.
 *
 * They are per-chunk rather than one global number, because the chunks do
 * different jobs. What matters for first paint is the sum of everything the
 * catalogue page actually loads; the dashboard's chart library is lazy and
 * keeper-only, so it gets its own, larger allowance and is excluded from the
 * critical-path total.
 */
const BUDGETS = [
  { match: /^index-.*\.css$/,      kb: 12,  critical: true,  why: 'whole stylesheet' },
  { match: /^index-.*\.js$/,       kb: 25,  critical: true,  why: 'application code' },
  { match: /^react-.*\.js$/,       kb: 70,  critical: true,  why: 'react + react-dom' },
  { match: /^state-.*\.js$/,       kb: 5,   critical: true,  why: 'zustand' },
  { match: /^vendor-.*\.js$/,      kb: 135, critical: false, why: 'recharts — lazy, keeper-only' },
  { match: /^DashboardCharts-.*\.js$/, kb: 10, critical: false, why: 'chart components - lazy' },
  // Per-route chunks. Deliberately off the critical path: each downloads only
  // when its route is visited, which is the whole point of splitting them out.
  { match: /^(ToolDetail|MyLoans|Desk|Dashboard|SignIn|loanStore)-.*\.js$/, kb: 8, critical: false, why: 'route chunk - lazy' },
];

const CRITICAL_PATH_KB = 100;   // what a first-time visitor to the catalogue downloads

const dir = path.resolve('dist/assets');
if (!fs.existsSync(dir)) {
  console.error('No dist/assets — run `npm run build` first.');
  process.exit(1);
}

let failed = false;
let criticalTotal = 0;

for (const file of fs.readdirSync(dir).sort()) {
  if (!/\.(js|css)$/.test(file)) continue;
  const budget = BUDGETS.find((b) => b.match.test(file));
  const kb = zlib.gzipSync(fs.readFileSync(path.join(dir, file))).length / 1024;

  if (!budget) {
    console.log(`?     ${file.padEnd(32)} ${kb.toFixed(1)} KB   (no budget defined)`);
    continue;
  }
  if (budget.critical) criticalTotal += kb;

  const over = kb > budget.kb;
  failed ||= over;
  console.log(
    `${over ? 'OVER ' : 'ok   '} ${file.padEnd(32)} ${kb.toFixed(1).padStart(6)} KB / ${String(budget.kb).padStart(3)} KB   ${budget.why}`,
  );
}

const overTotal = criticalTotal > CRITICAL_PATH_KB;
failed ||= overTotal;
console.log(
  `\n${overTotal ? 'OVER ' : 'ok   '} critical path total          ${criticalTotal.toFixed(1)} KB / ${CRITICAL_PATH_KB} KB gzipped`,
);

process.exit(failed ? 1 : 0);
