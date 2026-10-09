# Z_Pilot — Hôtel Zingana

Internal app: weekly task tracking and activity reports (weekly, monthly, Word export)
for one department of ~15 users. UI in French. Source of truth: the CDC v1.0
(2026-10-08); keep its identifiers (`EF-…`, `RG-…`, `REC-…`) in comments and tests.

## SvelteKit 3 specifics (do not apply Kit 2 habits)

- No `svelte.config.js`: Kit options and the adapter live in `sveltekit({...})` in `vite.config.ts`.
- Internal imports use `#lib/...` (Node subpath imports in `package.json`), not `$lib`.
- Env vars are declared and validated in `src/env.ts` (`defineEnvVars` + Zod), read from
  `$app/env/private` / `$app/env/public`. Add every new variable there and in `.env.example`.
- Remote functions (`$app/server` form/query/command) are still experimental: use form
  actions + sveltekit-superforms + Zod.
- Runes mode is forced for project files.

## Commands

`npm run lint` → `npm run check` → `npm run test:unit -- --run` → `npm run build`.
Build needs a syntactically valid `DATABASE_URL` (env is validated at build).
Schema change: edit `src/lib/server/db/schema.ts`, then `npm run db:generate`; never `db:push` on a shared DB.

## Architecture rules

- DB access only from `src/lib/server/**` (driver `pg` pool + `attachDatabasePool`;
  interactive transactions available). Publication, reopening and generation of reports
  run inside one transaction.
- Business rules are pure functions in `src/lib/domain/` with Vitest tests. Week logic
  lives in `src/lib/domain/week.ts` (ISO weeks, `Africa/Douala`, Wednesday rule §5.2).
- Weeks are keyed by their Monday (`week_start`, `date`). Timestamps are `timestamptz` (UTC).
- Rights are checked on the server for every request (CDC §2 matrix). A member only ever
  reads their own tasks and their own published reports.
- Invariants are DB constraints first (see schema), app checks second (for messages).
- Auth: custom sessions (token in HttpOnly cookie, SHA-256 hash in `sessions.token_hash`),
  passwords hashed with argon2id (`@node-rs/argon2`). No email anywhere in the MVP.
- Sensitive actions write to `audit_log` (accounts, password resets, publications,
  reopenings, generations).

## Frontend Theme

<always_use_zingana_theme>
Always design with the Z_Pilot / Hôtel Zingana aesthetic (tokens in `src/routes/layout.css`; reference: the client's dashboard mockup — navy sidebar, cream canvas, gold progress bars):

- Deep navy (`navy-700/800/900`) and gold (`gold-500`) on a warm cream canvas; gold for bars, rules and accents, never for body text.
- Use semantic tokens only (`bg-canvas`, `bg-surface`, `text-ink`, `text-ink-muted`, `border-line`, `bg-brand`, `text-accent-ink`, `success/warning/danger` + `-soft`); they carry light and dark values via `light-dark()`.
- Headings in `font-serif` (Source Serif 4), UI and data in `font-sans` (Public Sans), `tabular-nums` for figures.
- Navy sidebar with batik-pattern accents, white cards with thin borders, calm hospitality-luxury mood; icons from `@lucide/svelte`.
- Mobile-first: daily task check-in must work on a phone without zoom or horizontal scroll (REC-10). Visible focus, labelled checkboxes, information never carried by color alone.
  </always_use_zingana_theme>
