# MandateWatch

"Track every mandate. Measure every voice. Hold leaders accountable."

MandateWatch is a Nigerian civic-accountability platform — a directory of elected officials paired
with real citizen-driven approval ratings, demands, and discussion, so governance is measurable
*between* elections, not just at them.

Live at [mandatewatch.vercel.app](https://mandatewatch.vercel.app).

For the architecture decisions, backend schema, and full history of what's been built and why, see
**[CLAUDE.md](./CLAUDE.md)** — this README covers just what a new contributor needs to get running.

## Stack

- **Vite + React 19**, plain JavaScript (`.jsx`). TypeScript is used in exactly one place —
  `src/platform/` — see CLAUDE.md for why.
- **Supabase**: Postgres + Auth (magic-link) + Row Level Security. No custom backend server; the
  browser talks to Supabase directly.
- **`react-router-dom`** for client-side routing (`vercel.json` rewrites every path to
  `index.html`, required for this to work on Vercel).
- **`oxlint`** for linting (fast, Rust-based; already covers what a typical ESLint setup would).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your own Supabase project's URL + anon key
npm run dev
```

`scripts/seed.mjs` seeds reference data (states, LGAs, parties, representatives) into a fresh
Supabase project — see the comment at the top of that file for how to run it; it needs the
service-role key, which is never used by the app itself.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build (`dist/`) |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | `oxlint` |
| `npm run typecheck` | `tsc --noEmit` — checks `src/platform/`'s TypeScript only |
| `npm test` | `vitest` — a small, growing set of unit tests for pure logic |

## Folder overview

```
src/
  App.jsx              Nearly all app logic and UI (a large, single-file SPA by deliberate
                        choice so far — see CLAUDE.md's "Still open" list for the tradeoff).
  main.jsx             Entry point: BrowserRouter -> PlatformProvider -> App.
  data/                Static reference data (reps, parties, geography, Nigeria map paths) as
                        plain JS modules — the runtime source for client-side lookups even though
                        the same data is also seeded into Postgres.
  components/home/     The homepage storytelling sections (Slice 1B/1C), lazy-loaded as their own
                        bundle chunk since they're not needed for the core app experience.
  platform/            The Platform Architecture Layer (TypeScript) — brand, navigation, footer,
                        CTA labels, SEO metadata, feature flags, design tokens, all sourced from
                        one place via `usePlatform()`.
  hooks/, lib/          `useAuth` and the Supabase client singleton.
supabase/migrations/    Numbered SQL migrations, applied by hand in the Supabase SQL Editor (see
                        each file's header comment) — there's no migration runner/CLI wired up.
```

## Deploying

`vercel --prod --yes` from the project root. Environment variables (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`) are already configured on the Vercel project.
