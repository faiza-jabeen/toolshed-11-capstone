import bcrypt from 'bcryptjs';
import { db } from './db.js';

const TOOLS = [
  ['TS-0104','SDS hammer drill','power','B2',20,'Comes with a 6-piece masonry bit set.'],
  ['TS-0117','Random orbital sander','power','B4',10,'Bring your own discs, or buy them at the desk.'],
  ['TS-0121','Wet tile cutter','power','C1',25,'Heavy. Bring a car or a strong friend.'],
  ['TS-0125','Reciprocating saw','power','B3',15,'Two blades included, wood and metal.'],
  ['TS-0133','Scaffold tower, 4m','access','Yard',40,'Two-person collection only.'],
  ['TS-0140','Extending loft ladder','access','A1',15,'Fits openings up to 2.9m.'],
  ['TS-0146','Step platform','access','A2',8,'Light enough to carry one-handed.'],
  ['TS-0152','Petrol strimmer','garden','Yard',20,'Returned with a full tank, please.'],
  ['TS-0158','Lawn scarifier','garden','Yard',25,'Best used in early autumn.'],
  ['TS-0163','Long-reach hedge trimmer','garden','A3',15,'Goggles included on the hook.'],
  ['TS-0168','Garden shredder','garden','Yard',20,'Branches up to 40mm.'],
  ['TS-0171','Wallpaper steamer','decorate','C3',10,'Takes 8 minutes to heat up.'],
  ['TS-0175','Airless paint sprayer','decorate','C4',30,'Must be returned flushed and clean.'],
  ['TS-0182','Carpet stretcher','decorate','D1',10,'Knee kicker included.'],
  ['TS-0190','Thermal imaging camera','measure','Desk',35,'Find the draught before you buy the sealant.'],
  ['TS-0194','Damp meter','measure','Desk',5,'Two-pin and pinless modes.'],
  ['TS-0199','Laser level, 20m','measure','B1',15,'Self-levelling, green beam.'],
  ['TS-0205','Bench vice, 6in','hand','D2',10,'Bolts to the bench at the back.'],
  ['TS-0211','Pipe bender','hand','D3',12,'15mm and 22mm formers.'],
  ['TS-0216','Socket set, 210pc','hand','D4',15,'Count them back in, please.'],
];

const PEOPLE = [
  ['ada@toolshed.test',   'Ada Whitfield', 'keeper'],
  ['sam@toolshed.test',   'Sam Okoro',     'member'],
  ['priya@toolshed.test', 'Priya Nair',    'member'],
  ['tom@toolshed.test',   'Tom Bergqvist', 'member'],
  ['lena@toolshed.test',  'Lena Farouk',   'member'],
];
const PASSWORD = 'shed-ladder-9912';

const PULL = { power: 1.0, garden: 0.8, decorate: 0.55, access: 0.5, measure: 0.3, hand: 0.45 };
const SEASON = [0.5,0.5,0.8,1.2,1.5,1.4,1.2,1.1,1.0,0.8,0.5,0.4];

let rng = 20260826;
const rand = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const iso = (d) => d.toISOString().slice(0, 10);

db.exec('DELETE FROM loans; DELETE FROM tools; DELETE FROM refresh_tokens; DELETE FROM users;');

const hash = bcrypt.hashSync(PASSWORD, 10);
const addUser = db.prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?,?,?,?)');
db.transaction(() => PEOPLE.forEach(([e, n, r]) => addUser.run(e, n, hash, r)))();

const addTool = db.prepare('INSERT INTO tools (asset_tag, name, category, shelf, deposit, notes) VALUES (?,?,?,?,?,?)');
db.transaction(() => TOOLS.forEach((t) => addTool.run(...t)))();

const tools = db.prepare('SELECT * FROM tools').all();
const members = db.prepare("SELECT * FROM users").all();
const addLoan = db.prepare('INSERT INTO loans (tool_id, user_id, borrowed_on, due_on, returned_on) VALUES (?,?,?,?,?)');

/* Twelve months of closed loans, so the dashboard has something to say. The
   partial unique index forbids two open loans on one tool, so history is built
   strictly closed-first and the open ones are added at the end. */
db.transaction(() => {
  const end = new Date();
  for (let back = 364; back >= 14; back--) {
    const day = new Date(end.getTime() - back * 86400_000);
    if (![2, 4, 6].includes(day.getUTCDay())) continue;          // Tue/Thu/Sat only
    const season = SEASON[day.getUTCMonth()];

    for (const tool of tools) {
      if (rand() > 0.18 * PULL[tool.category] * (tool.category === 'garden' ? season : 1)) continue;
      const late = rand() < 0.12 ? Math.ceil(rand() * 9) : 0;
      const kept = Math.ceil(rand() * 7) + late;
      if (kept >= back) continue;                                 // must close before today
      addLoan.run(
        tool.id,
        members[1 + Math.floor(rand() * (members.length - 1))].id,
        iso(day),
        iso(new Date(day.getTime() + 7 * 86400_000)),
        iso(new Date(day.getTime() + kept * 86400_000)),
      );
    }
  }
})();

/* Four live loans, one of them deliberately overdue so the overdue styling and
   the dashboard's overdue slice both have something real to render. */
const open = [
  [tools[2],  members[1], -3, 4],
  [tools[4],  members[2], -6, 1],
  [tools[9],  members[3], -1, 6],
  [tools[16], members[4], -12, -5],   // overdue by five days
];
db.transaction(() => {
  for (const [tool, user, borrowedOffset, dueOffset] of open) {
    addLoan.run(tool.id, user.id,
      iso(new Date(Date.now() + borrowedOffset * 86400_000)),
      iso(new Date(Date.now() + dueOffset * 86400_000)), null);
    db.prepare("UPDATE tools SET status = 'out' WHERE id = ?").run(tool.id);
  }
  db.prepare("UPDATE tools SET status = 'repair', notes = 'Waiting on a new tine drum.' WHERE asset_tag = 'TS-0158'").run();
})();

const n = (sql) => db.prepare(sql).get().c;
console.log(`Seeded ${n('SELECT COUNT(*) c FROM tools')} tools, ${n('SELECT COUNT(*) c FROM users')} people, ${n('SELECT COUNT(*) c FROM loans')} loans (${n('SELECT COUNT(*) c FROM loans WHERE returned_on IS NULL')} still out).`);
console.log(`\n  keeper: ada@toolshed.test / ${PASSWORD}`);
console.log(`  member: sam@toolshed.test / ${PASSWORD}\n`);
