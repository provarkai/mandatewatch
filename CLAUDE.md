# MandateWatch

## Mission
"Track every mandate. Measure every voice. Hold leaders accountable."

MandateWatch is a Nigerian civic-accountability platform. It is **not** an election-results
website — its core purpose is measuring governance *between* elections through citizen
participation. Election-related functionality (Election Watch / Aspirants) is secondary and only
surfaces during a defined election period, gated by **Election Mode** (see below).

## Core capabilities
- Representative Directory
- Approval Ratings
- Citizen Pulse Polls (rep votes — approval/presence)
- Constituency Projects
- Citizen Demands (Demands Board)
- Discussions
- State Pulse
- Analytics
- Election Watch / Aspirants (secondary, Election-Mode-gated)

## Current stack (reality check)
- **Vite + React 19 SPA**, plain JavaScript (`.jsx`), not TypeScript. Deployed to Vercel
  (`mandatewatch.vercel.app`) via `vercel --prod --yes`.
- **Supabase** is the entire backend: Postgres + Auth (magic-link) + RLS. No custom server, no API
  routes — the browser talks to Supabase directly via `@supabase/supabase-js`.
- Decision (locked in during Slice 1, reaffirmed since): **stay on Vite, no Next.js migration**.
  "Use TypeScript" / "use server components" from earlier planning docs don't apply to this stack
  as written — they're long-term aspirational guidance, not a mandate to rewrite. If the user
  explicitly asks to migrate to TypeScript or Next.js, treat that as a new, separate decision to
  plan for — don't drift toward it incrementally on your own.
- Nearly all app logic lives in `src/App.jsx`. Reference/static data lives in `src/data/*.js`
  (`reps.js`, `geography.js`, `parties.js`) — these stay the runtime source for client-side lookups
  even though the same data is also seeded into Postgres (no reason to re-fetch ~2,200 rarely-changing
  reference rows over the network).

## Architecture patterns established so far
- **Public-read + private-write-your-own + `SECURITY DEFINER` trigger** is the standard shape for
  anything with a vote/score: a content table (public `select`, insert-your-own only, immutable —
  no update/delete from the client) plus a `*_votes`/`*_upvotes` table (insert-your-own, select-own,
  unique constraint enforcing one vote per user) plus a trigger function that bumps the counter.
  Examples: `rep_votes`/`rep_scores`/`bump_rep_score()`, `demand_upvotes`/`bump_demand_upvotes()`,
  `thread_votes`/`comment_votes`.
- **Narrow `SECURITY DEFINER` RPCs over broad RLS update policies** for anything admin-gated or
  cross-table: `approve_rep_claim`, `reject_rep_claim`, `acknowledge_demand`. Each checks the
  caller's authorization (membership in `admins`, or `representatives.claimed_by = auth.uid()`)
  before touching anything, and only ever touches the specific column(s) the action needs — avoids
  the column-level-vs-row-level RLS gap (a raw update policy can't restrict *which* columns a caller
  changes, only *which rows*).
- **Snapshot public display fields at insert time** (`submitted_by_name`, `requester_name`, etc.)
  rather than joining `profiles` at read time — `profiles` RLS only allows reading your own row
  (it holds `phone`, deliberately private), so denormalizing avoids ever loosening that policy.
- **Admin allowlist via a separate `admins` table**, not a boolean column on `profiles` — a column
  there would be reachable by the existing "update own profile" policy (RLS is row-level, not
  column-level), letting a user grant themselves admin. `admins` has no client insert/update/delete
  policy at all; only added via the SQL Editor with the service-role key.
- Real, persistent features are added slice by slice, each via a numbered migration
  (`supabase/migrations/000N_*.sql`) written by Claude and run by the user in the Supabase SQL
  Editor — the service-role key stays with the user, never touched by Claude directly.

## Engineering principles
- Production-ready, no placeholder implementations, unless explicitly told otherwise for a given
  slice (e.g. Stewardship and parts of Election Watch remain intentionally local-only/mock until
  their own slice ships — this is a scoping decision per feature, not a general license to stub).
- Clean architecture, reusable components, no duplicated logic, configuration over hardcoding.
- Never remove existing functionality unless instructed. Always preserve backwards compatibility.
- Optimize for correctness and real persistence over speed of typing code — grep the compiled
  bundle / check the live site rather than assuming a deploy worked.

## Workflow for each new slice
1. Understand the existing codebase (grep/read before assuming).
2. Plan (use plan mode for anything multi-file or architecturally non-trivial).
3. Explain which files will change and why.
4. Implement.
5. Test / verify live (the user is the only one with a browser in this loop — they run the
   verification checklist, not just `npm run build`).
6. Refactor if needed.
7. Ensure no regressions.
8. Commit-ready code, committed and pushed only when the user asks.

## Slices shipped so far
1. Reps + votes + real magic-link auth (`profiles`, `representatives`, `rep_scores`, `rep_votes`).
2. Demands Board (`demands`, `demand_upvotes`) + admin panel lockdown (`admins` table, footer link
   gated to allowlisted accounts).
3. Discussion (`threads`, `thread_votes`, `comments`, `comment_votes`).
4. Rep Claims, admin-reviewed (`rep_claim_requests`, `approve_rep_claim`/`reject_rep_claim` RPCs,
   real `representatives.claimed_by`) + real Acknowledge/Mark Delivered on demands
   (`acknowledge_demand` RPC).

## Still open
- Election Mode (gating Election Watch/Aspirants to a real election period — in progress).
- Stewardship (claimed rep posts what they've delivered, citizens verify) — still local-only.
- Election Watch / Aspirants real data — still fully mock (`ASPIRANTS = []`).
