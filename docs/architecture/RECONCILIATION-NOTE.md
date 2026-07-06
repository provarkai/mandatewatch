# Reconciliation Note — MPAS v2.0 vs. Actual Build State

**Read this before treating `MPAS-v2.md` as current.** The specification was written against the
original client-only prototype. Since then, this session shipped a real backend (Supabase), real
auth, real routing, and real admin/claim security. Several of the spec's "current state" claims —
and, most importantly, two of its **launch-blocking Critical risks** — are no longer accurate.
This note is the correction layer; `CLAUDE.md` remains the authoritative, continuously-updated
record of what's actually built.

## Corrections to "current state" claims

| Spec claim | Chapter | Actual state |
|---|---|---|
| Admin panel "fully functional and entirely unsecured" | 4.2, 18.1, Risk 1 | **Resolved.** `admins` allowlist table + `isAdmin` check gates the footer link entirely; non-admins never see it. |
| Rep claim is "an unauthenticated client toggle... anyone can claim any representative" | 8.4, 16.4, Risk 2 | **Resolved.** Real `rep_claim_requests` table, admin-reviewed via `approve_rep_claim`/`reject_rep_claim` RPCs. `representatives.claimed_by` is only ever set by the approval RPC, never a direct client write. |
| Sign-in is "simulated (any 4-digit code succeeds)" | 7.1, 11.4 | **Resolved.** Real Supabase magic-link auth, real JWT sessions. |
| "No backend... all data in client-side React state... no deployed production instance" | Preamble, 1.1 | **Resolved.** Full Supabase Postgres backend, 6 migrations, RLS throughout; live on Vercel (`mandatewatch.vercel.app`) for the entire session. |
| Navigation has "no server-side session... no persistent identity... a page refresh loses all session state" | 6.2, 7.1 | **Resolved.** Real `react-router-dom` routing with persistent, bookmarkable URLs (`/`, `/pulsemap`, `/demands`, `/discussion`, `/representatives/:id`, `/me`, `/admin`), a `vercel.json` SPA rewrite, and a real 404 state for unmatched paths. |
| Election Mode is a pure "Future Consideration," not scheduled | 18.4 | **Ahead of spec.** Built and live — an admin-toggleable, Supabase-backed flag (`app_settings.election_mode_enabled`) gates the Election Watch tab site-wide. |
| No automated testing exists | 20.5, Risk 5 | **Partially resolved.** `vitest` is wired up with real passing tests, though coverage is still minimal (routing logic only) — the spec's underlying concern (no CI build-gate, no RLS policy tests) still stands. |

## Findings that are STILL accurate — don't assume these are fixed

- **"PulseMap" naming/content mismatch (13.1, 37.2, open question 7):** still true. The map component genuinely colors by *volume of officials tracked*, not sentiment — confirmed directly in the current `NigeriaMap` component's `counts` calculation. The spec's recommendation (call it "Representative Map" in citizen-facing copy until sentiment-based coloring ships) has **not** been acted on — the live product calls it "PulseMap™" today, which is exactly the mismatch this finding warns about.
- **Feature-flag-driven pilot-state gating (18.2, 18.3, Risk 11):** still a real gap. The six pilot states (Lagos, Ogun, Rivers, Kano, Abia, Edo) are displayed as rollout messaging (the homepage's Public Beta section) but participation features (Demands, Discussion) are **not actually restricted** to those states — any state's citizens can file demands and post today. The spec's concern that the pilot strategy is "currently a roadmap intention, not something the product can actually enforce" remains true.
- **No community standards document, no notification system, no rate limiting on content creation** (16.5, 15.2, 15.4) — all still genuinely unbuilt.
- **Single-file architecture** (20.1) — still substantially true. `App.jsx` remains ~3,100+ lines; this session extracted a platform config layer, homepage components, and a couple of pure-logic modules, but did not do the full restructuring Chapter 20 describes.
- **The four legal-instrument gaps** (Risks 20–23: no real Terms of Service/Privacy Policy, no documented legal entity structure, no content-licensing terms, no Electoral Act compliance review) — all still genuinely open, and outside engineering's ability to resolve. See `docs/legal/` for draft starting points, explicitly not legal advice.

## What this means going forward

Treat `MPAS-v2.md` as the long-term product/architecture vision and a source of real, still-relevant
findings (the two above especially) — not as an accurate snapshot of what exists today. `CLAUDE.md`
is where "what's actually built" lives and gets updated every slice; when the two disagree, `CLAUDE.md`
wins.
