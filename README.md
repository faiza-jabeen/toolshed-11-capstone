# Kirkgate Toolshed

**Capstone â€” Neurofive Solutions Full Stack Web Development internship.**

A working tool library. Members browse the shelf, borrow up to three tools for a
week, and extend a loan if a job runs over. Keepers check tools back in at the
desk, add donations to the catalogue, and see whether the shed is actually being
used.

> **Demo logins:** keeper `ada@toolshed.test` Â· member `sam@toolshed.test` â€” both `shed-ladder-9912`

---

## The problem

A cordless drill spends about thirteen minutes of its entire life drilling. A
tile cutter gets used once, for one bathroom, and then occupies a shelf in a
garage for eleven years. Tool libraries fix that, and there are now hundreds of
them â€” but most run on a paper ledger and a shared spreadsheet, which means
nobody can tell you whether a tool is in the building without walking over to
look.

Toolshed answers three questions the paper ledger cannot: **what is on the shelf
right now**, **who has the thing that is missing**, and **which tools earn their
shelf space** â€” the last one being what decides the next grant application.

## Screens

| Route | Who | What it does |
|---|---|---|
| `/` | anyone | The catalogue: search, filter by shelf, live counts of in / out / in-repair |
| `/tools/:id` | anyone | One tool, its notes and deposit; the borrow form for members |
| `/loans` | signed in | Your open loans with due dates, extend a loan, your borrowing history |
| `/desk` | keeper | Check tools back in, add donations, retire tools â€” the Saturday-morning screen |
| `/dashboard` | keeper | Borrowing over time, by category, where everything is, busiest tools |
| `/signin` | anyone | Sign in or join, one form with a mode switch |

## Architecture

```
React 19 + Vite â”€â”€ React Router 7 â”€â”€ Zustand 4 stores
        â”‚  fetch, access token in memory, refresh cookie
        â–¼
Express 4  â”€â”€ requireAuth â†’ requireRole â†’ validate â†’ route
        â–¼
SQLite (better-sqlite3, WAL) â€” users Â· tools Â· loans
```

**Two related resources.** `loans` references both `tools` and `users`, and the
relationship is enforced rather than assumed:

- Borrowing sets the tool to `out` **in the same transaction** as inserting the
  loan. Checking two statements separately is a race two members can both win.
- A **partial unique index** â€” `UNIQUE(tool_id) WHERE returned_on IS NULL` â€”
  means the database itself forbids two open loans on one tool. Two keepers
  clicking "lend" simultaneously: one succeeds, one gets a 409.
- A tool that is out **cannot be retired**. It has to come home first.
- Retiring a tool with loan history **keeps the history** and marks the tool
  instead of deleting it, because a hard delete would silently corrupt every
  figure on the dashboard.

## Authentication and permissions

Access token in **memory only** â€” never `localStorage`, which any XSS can read.
Session continuity comes from an **httpOnly refresh cookie**, stored SHA-256
hashed and **rotated on every use**, so a captured token is single-use and
logout genuinely ends the session server-side. Passwords are bcrypt at cost 12.

| | member | keeper |
|---|---|---|
| browse the catalogue | âœ” (no account needed) | âœ” |
| borrow | âœ” 3 tools, 7 days | âœ” 6 tools, 14 days |
| extend own loan | âœ” | âœ” |
| see others' loans | âœ˜ | âœ” |
| check tools in | âœ˜ | âœ” |
| add / retire tools | âœ˜ | âœ” |
| dashboard | âœ˜ | âœ” |

**Scoping is applied from the token, never from a query parameter.** A
`?userId=` filter would let anyone read anyone's borrowing history. The client
guard is convenience; every endpoint checks again.

## Stretch goals

1. **Keeper dashboard** â€” four headline figures each with the previous period
   for comparison, a weekly line chart, a category bar chart, a live donut and a
   ranked table. Aggregated in SQL, one round trip. Recharts is lazily loaded so
   the 123 KB never touches the catalogue page.
2. **Dark mode** â€” follows the OS until you override it. Only the palette is
   redeclared; spacing, type and radius tokens are shared, so the themes cannot
   drift. Applied by a tiny inline script **before React mounts**, so dark-mode
   users never see a white flash. Charts re-read the tokens on toggle.
3. **CI/CD and Docker** â€” GitHub Actions runs API tests â†’ client tests â†’ bundle
   budget â†’ Lighthouse. Multi-stage Dockerfile, non-root, healthchecked. Render
   blueprint with a persistent disk.

## Running it

```bash
# API
cd server
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # Ã—2 into .env
npm install
npm run seed        # 20 tools, 5 people, ~340 loans across a year
npm run dev         # :4000

# client
cd ../client
npm install
npm run dev         # :5173
```

`SLOW_MODE=1 npm run dev` on the server adds 900ms per request, which is how you
actually see the skeletons and button spinners on localhost.

The seed builds a realistic year: the shed opens Tuesday, Thursday and Saturday
only, power tools go out constantly and measuring kit rarely, garden tools are
seasonal, ~12% of loans come back late, and **one loan is deliberately overdue**
so the overdue styling and the dashboard's overdue slice both have something
real to render.

## Tests â€” 66

```bash
cd server && npm test      # 42
cd client && npm test      # 24
```

| Area | Covers |
|---|---|
| **Auth (14)** | HttpOnly cookie, no hash ever in a response, weak password, duplicate email case-insensitively, **identical message for wrong password and unknown email**, **replayed refresh token 401s**, logout revokes, forged token 401 |
| **Tools (14)** | public read, filters, keeper create, **all five invalid fields at once**, duplicate tag 409 not 400, partial patch, empty patch 400 |
| **Loans (14)** | borrow flips tool status, **double-borrow 409**, **out tool cannot be retired**, loan-length limits, **member cannot check in their own tool**, keeper check-in restores the shelf, double check-in 409, member sees only their own, **allowance stops the 4th loan**, retiring keeps history |
| **Frontend (24)** | ToolCard rendering and links, **status in words not only colour**, ToolDetail across signed-out / available / out / repair, server field errors, failed load, **RequireAuth's three states**, dark mode resolution and **surviving localStorage throwing** |

The `booting` branch of `RequireAuth` has its own test because redirecting there
is the bug that bounces a valid session to sign-in on every hard reload.

## Performance

```
ok   index.css              4.6 KB /  12 KB   whole stylesheet
ok   index.js              10.9 KB /  25 KB   application code
ok   react.js              59.0 KB /  70 KB   react + react-dom
ok   state.js               0.7 KB /   5 KB   zustand
ok   vendor.js            123.4 KB / 135 KB   recharts â€” lazy, keeper-only
ok   critical path total   75.2 KB / 100 KB gzipped
```

Budgets are per-chunk and **enforced in CI**, with a separate critical-path
total â€” recharts is excluded from it because a first-time visitor to the
catalogue never downloads it. Vendor code is split from app code so a deploy
invalidates 10.9 KB rather than everything.

Also: gzip on the API (2,272 B â†’ 632 B on the catalogue response), fonts loaded
non-blocking, immutable caching on hashed assets and `must-revalidate` on
`index.html`, security headers, graceful `SIGTERM` that checkpoints the WAL.

## Deploying

`render.yaml` is a one-click blueprint: API with a **persistent disk** (Render's
filesystem is ephemeral â€” SQLite in the working directory loses every account on
the next deploy), secrets generated automatically, static client with the SPA
rewrite. Set `CORS_ORIGIN` and `VITE_API_URL` once both URLs exist. **Both ends
must be HTTPS** or the `sameSite=none; secure` refresh cookie is rejected and
nobody stays signed in.

## What I would do next

- **Reservations.** Right now you can only borrow what is on the shelf. A queue
  for the scaffold tower is the most-requested thing a real tool library needs.
- **Postgres.** SQLite has been the right call â€” one file, no service, real
  transactions â€” but it pins the API to one instance. The data layer is behind
  `db.js` precisely so that swap is contained.
- **Tool photos.** Built in task 07; folding it in means a `photo_key` column
  and the Cloudinary driver, not new architecture.
- **Email.** Overdue reminders would remove most of the phone calls, and the
  overdue query already exists.

## What went wrong, and what it taught me

Three bugs in this codebase were found by tests, not by looking at it â€” all in
code that built cleanly and looked fine:

1. **An infinite render loop.** Zustand v5 compares selector output with
   `Object.is`, and my `selectVisibleTools` built a new array on every call, so
   it looked "changed" on every read. Invisible until something rendered.
   `useShallow` fixed it.
2. **The API envelope unwrapped twice** â€” `const { data } = await api('/tools')`
   where `api()` already returned `payload.data`. The catalogue would have been
   permanently empty in the browser.
3. **`createdAt` silently dropped** by a row mapper that listed every column but
   that one.

The lesson I actually took: **a green build proves nothing about behaviour.**
Every one of those would have shipped. It also changed how I write mocks â€” the
`fetch` stub now returns a real 401 for an anonymous refresh, because the first
version was kinder than production and hid a fourth bug.

