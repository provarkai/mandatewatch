# MandateWatch

## Mission
"Track every mandate. Measure every voice. Hold leaders accountable."

MandateWatch is a Nigerian civic-accountability platform. It is **not** an election-results
website — its core purpose is measuring governance *between* elections through citizen
participation. Election-related functionality (Election Watch / Aspirants) is secondary and only
surfaces during a defined election period, gated by **Election Mode** (see below).

**Long-term product/architecture vision:** `docs/architecture/MPAS-v2.md` (38-chapter product
architecture specification). **Read `docs/architecture/RECONCILIATION-NOTE.md` before trusting any
of its "current state" claims** — it was written against the original client-only prototype and
significantly predates this file's record of what's actually shipped. Where the two disagree,
*this file* wins. Two of its findings are still genuinely accurate against the real app today and
worth acting on eventually: the PulseMap component still colors by rep-count, not sentiment
(MPAS §13.1); and the six pilot states are only *displayed* as rollout messaging, not actually
enforced as a feature gate (MPAS §18.2-18.3).

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
  (`mandatewatch.vercel.app`) via `vercel --prod --yes`. `vercel.json` rewrites every path to
  `/index.html` — required for client-side routing (see below); don't remove it.
- **Real client-side routing via `react-router-dom`** (added as the prerequisite for the Slice 1D
  mega-footer). Navigation state (`tab`, `openRepId`, `userProfileOpen`, `stewardshipRepId` in
  `App.jsx`) is derived from `useLocation()`/parsed from the URL rather than `useState`, with a
  same-named setter that calls `navigate()` — this was a deliberate choice to avoid rewriting the
  render tree into nested `<Routes>`/`<Outlet>`, so almost every existing `tab === "x"` conditional
  and `setTab("x")` call site needed zero changes. Real paths: `/`, `/pulsemap`, `/demands`,
  `/discussion`, `/election`, `/admin`, `/representatives/:id`,
  `/representatives/:id/stewardship`, `/me`. `platform.config.ts`'s navigation/product/footer-link
  entries use a `path` field with real URL values (not the old bare `tab` keys). When adding a new
  top-level view, follow this same shim pattern rather than introducing a second navigation
  mechanism.
- Nested `<Routes>`/`<Outlet>` was considered and deliberately rejected for this pass — it would
  need an `AppLayout` extraction and prop-drilling most of `MandateWatch`'s state. Revisit only if
  the shim approach genuinely stops scaling (e.g. many more top-level pages).
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

5. Election Mode gating (`app_settings.election_mode_enabled`, admin-toggleable, hides/shows the
   Election Watch tab site-wide).
6. **Platform Architecture Layer** (`src/platform/` — TypeScript, the only TS in the app; everything
   else stays plain JS per an explicit decision). `PlatformProvider`/`usePlatform()` centralize
   brand copy, navigation, footer, CTA labels, SEO metadata, feature flags, markets/rollout, and
   design tokens. Wired into the live UI: header CTA, hero copy, nav tabs (now driven by
   `platform.navigation`), footer, and the `<style>` block's color `:root` all source from it.
   `NigeriaMap` was promoted from an always-visible hero widget into its own `"pulsemap"` tab
   (PulseMap™) as part of this. Election Mode's flag is deliberately **not** duplicated into the
   static `FEATURE_FLAGS` config — it already has a real, live, DB-backed source of truth (item 5);
   see `src/platform/types.ts` for the reasoning. `index.html`'s SEO tags are kept in sync by hand
   with `src/platform/platform.config.ts`'s `SEO` export (no SSR/templating exists to automate this
   in a router-less Vite SPA).
7. **Homepage storytelling** (`src/components/home/` — plain JS/JSX, twelve components composed by
   `HomepageStory.jsx`, lazy-loaded from `App.jsx` via `React.lazy`/`Suspense` as its own chunk).
   Ten sections between the existing Hero and the app tabs (comparison cards, mission timeline,
   live data preview, how-it-works, audience cards, methodology, trust grid, insights preview,
   public beta, final CTA) plus a short transition strip into the tabs. `LivePreview` and
   `InsightsPreview` pull real numbers from `repsData`/`demandsList`/`threadsList` already in memory
   — no fabricated content; Insights' "Read Insight" and Methodology's "Learn More" buttons are
   visibly disabled ("Coming soon"), not dead links, since neither feature is built yet. The
   election countdown/"Will you vote?" widget (`CountdownTimer`/`VotePoll`) moved from always-
   visible to `{electionModeEnabled && (...)}` — same flag as item 5, not a new mechanism.
8. **Institutional trust & governance sequence** (Slice 1C) — inserted into `HomepageStory.jsx`
   after Slice 1B's product-discovery run (Comparison Cards → Live Preview → How It Works →
   Audience Cards): Institutional Trust (relocated `TrustGrid`) → Accountability Standard →
   Methodology (relocated `MethodologySection`) → Open Data Philosophy → Principles → Transparency
   → Research & Media (relocated/retitled `InsightsPreview`) → Roadmap → Newsletter → Public Beta →
   final CTA. `Principles` renders `platform.brand.values` directly; `Roadmap` renders
   `platform.products.filter(p => p.status === "unreleased")` directly — the Product Module *is*
   the roadmap, no separate data structure. `Newsletter` has a real capture backend
   (`newsletter_signups`, public-insert/admin-only-read) — no in-app admin UI to browse it yet, view
   it via the Supabase Table Editor. The full Stripe/GitHub-style mega-footer and four-pillar nav
   (Platform/Participation/Accountability/Resources) discussed alongside this were **deferred**
   pending a routing decision — resolved by item 9 below.
9. **Real client-side routing** (`react-router-dom` + `vercel.json` rewrite) — see "Current stack"
   above for the shim pattern. This was the prerequisite for Slice 1D (mega-footer + four-pillar
   nav + new destination pages), now unblocked.
10. **Engineering readiness pass** (Slice 1D) — dead-code/lint cleanup (including a real bug fix:
    `handleAddComment` was never sending `body` to Supabase, so every Discussion reply had been
    silently failing the `comments.body not null` constraint since Slice 3 — fixed); logo.png
    1.05MB → 137KB; Google Fonts moved from a render-blocking `@import` to `<link>` tags in
    `index.html`; the Nigeria map's ~65KB of SVG path data (`src/data/nigeriaMapPaths.js`) now
    lazy-loads only when `/pulsemap` is visited; a real 404 state for unmatched routes
    (`isKnownPath`/`tabFromPath` in `src/lib/routing.js`, unit-tested via `vitest` —
    `npm test`); `prefers-reduced-motion` support and a `.mw-search` focus-visible fix;
    `manifest.json`/`robots.txt`/`sitemap.xml` added.
11. **Real axe DevTools scan, fixes applied** — the user ran axe on the Slice 1D build and found:
    an unlabeled `<select>` (the region/state filter — fixed with `aria-label`, plus the two
    identical filters on Aspirants/Demands that shared the gap); `.hs-step-number` using `--line`
    (a border color) as text, 1.37:1 contrast (fixed → `--ink-soft`); four small-text `--brass`
    usages in `homepage-story.css` at 3.35-3.62:1 (fixed → `--verdant`, confirming the contrast
    gap already flagged, unconfirmed, in item 10's QA report); and, found proactively afterward by
    computing the *actual composited* contrast (not the flat-token number) for
    `.mw-stewardship-cta`/`.mw-official-badge`'s brass-tinted backgrounds — 3.24:1, also failing.
    Added **`--brass-dark`** (`#7F5B17`, mirrors the existing `--verdant-dark` pattern) rather than
    switching those two to `--verdant` like the homepage instances, since they specifically mean
    "official response," distinct from the `--verdant` "verified claim" badge — color-family
    swaps would blur that. All fixes verified against real computed luminance/contrast math, not
    guessed.

## Security notes (reviewed, not a full pentest)
- **Client-side route/tab visibility is never the actual security boundary in this app — RLS is.**
  E.g. the Admin tab is hidden client-side when `!isAdmin`, but the *real* protection is that
  `approve_rep_claim`/`reject_rep_claim`/`acknowledge_demand` all re-check `admins`/`claimed_by`
  membership server-side (migrations `0004`+) — a user who forced the tab open client-side still
  couldn't do anything, because the RPCs would reject them. Keep this invariant for any new
  admin-ish feature: gate the UI for UX, but always re-check server-side.
- **No `dangerouslySetInnerHTML`, `eval`, or `new Function` anywhere in `src/`** (grepped, zero
  hits) — React's default JSX escaping is the only XSS defense in place, and it's sufficient as
  long as this stays true. Watch for this the first time anyone renders user-submitted content as
  literal HTML (e.g. a future "rich text" demand description).
- **Client-side input validation (email regex in `Newsletter.jsx`, phone regex in `AuthModal`) is
  UX sugar, not the real boundary** — Postgres `check` constraints and RLS `with check` clauses are
  what actually enforce data integrity (e.g. `demands.status` can only be one of three values
  because of a `check` constraint, not because the client only ever sends one of three values).
- **Historical incident, worth remembering**: earlier this session, a PowerShell pipe silently
  prepended a BOM character to the Supabase anon key when setting it as a Vercel env var, causing
  a hard-to-diagnose auth failure. Lesson already applied: env vars are now set via
  `vercel env add --value <value>` (args array), never piped through PowerShell.
- **Recommended for a future slice, not implemented**: real RBAC beyond the single `admins`
  allowlist (e.g. a moderator role distinct from full admin) if the admin surface grows;
  rate-limiting on `newsletter_signups`/`rep_claim_requests` inserts (currently unlimited public
  inserts, gated only by the unique-email constraint and Supabase's own default abuse protection).

## Observability (architecture notes only — nothing implemented)
- No analytics, error logging, or performance monitoring exist yet. If/when added: `main.jsx` is
  the natural init point (wrap `<BrowserRouter>` at the very top), and `src/platform/` is the
  natural home for a future `analytics` or `observability` config module (API keys, sample rates)
  following the same pattern as `FEATURE_FLAGS` — a typed config object, not scattered `if` checks.
- Feature flags already exist (`src/platform/platform.config.ts`'s `FEATURE_FLAGS`) as the
  extension point for any future experimentation — a real A/B test would read a flag from there,
  not add a new ad hoc mechanism.
- Audit-log-style tracking (who approved which rep claim, who toggled Election Mode) isn't
  captured today beyond `reviewed_by`/`reviewed_at` on `rep_claim_requests` — worth a dedicated
  `audit_log` table if/when this becomes a real requirement, rather than bolting timestamps onto
  every table individually.

## Still open
- Stewardship (claimed rep posts what they've delivered, citizens verify) — still local-only.
- Election Watch / Aspirants real data — still fully mock (`ASPIRANTS = []`).
- Footer's Resources/Company/Support/Legal columns are intentionally empty (no real pages/routes
  exist yet) — populate once those destinations are real, not with placeholder links. Routing
  itself is no longer the blocker (item 9) — the pages themselves still need to be built.
- Mega-footer + four-pillar nav (Platform/Participation/Accountability/Resources) redesign — this is
  Slice 1D, not yet started.
- No in-app admin UI to view/export `newsletter_signups` yet — Supabase Table Editor only.
- Insights, Pulse Reports/Rankings/Index, Open Civic API, Research Centre, Developer Platform,
  Analytics Suite are registered in `src/platform/platform.config.ts`'s `PRODUCTS` as `unreleased`
  — metadata only, nothing built.
- **Legal instruments — genuinely unaddressed, not engineering work** (surfaced by MPAS-v2.md
  Chapter 25, Risks 20–23): no real Terms of Service or Privacy Policy the user actually agrees to
  (draft starting points at `docs/legal/`, explicitly not legal advice — need real review); no
  documented legal entity structure for MandateWatch; no content-licensing terms for citizen-
  submitted demands/comments/Stewardship entries; no legal review of Nigerian Electoral Act
  compliance for election-adjacent polling (Election Watch/aspirant favorability) near a real
  election date. None of these are resolvable by writing code — they need the user or legal counsel.
- Community standards document (for future moderation), a notification system (so a citizen learns
  when their demand gets a response), and rate limiting on content creation are all still genuinely
  unbuilt (MPAS-v2.md Chapters 15–16).
