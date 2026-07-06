# Legal documents — status

**Everything in this folder is a draft starting point, not a legal document, and not legal advice.**
Neither of the two files here has been reviewed by a lawyer. Do not publish, link, or rely on
either as a binding agreement until qualified legal counsel has reviewed and approved them for
Nigerian law specifically (data protection, defamation, and Electoral Act considerations — see
`docs/architecture/MPAS-v2.md`, Chapter 25, Risks 20–23).

## What's here

- **`TERMS-OF-SERVICE-DRAFT.md`** — a starting point covering account creation, content ownership,
  acceptable use, and the platform's neutrality/non-adjudication stance.
- **`PRIVACY-POLICY-DRAFT.md`** — a starting point describing what data MandateWatch actually
  collects and how, grounded in the real schema (not generic boilerplate) — see the "Written
  against the real app" note in that file.

## Why these were drafted this way

Both documents are grounded in what the app **actually does today** (verified against the real
Supabase schema and RLS policies, not assumed) rather than generic template language, so that a
lawyer reviewing them is correcting/tightening real practice, not first having to figure out what
the product even does. Where the app's real behavior seemed to need a policy decision the drafts
couldn't make unilaterally (e.g., exact data retention periods, dispute resolution jurisdiction),
that's flagged inline as `[NEEDS DECISION]` or `[NEEDS LEGAL INPUT]` rather than filled with a
plausible-sounding default.

## Before either is published

1. Legal counsel review, specifically for Nigerian data protection law (NDPA) and defamation
   exposure given the platform tracks named public officials.
2. A decision on MandateWatch's actual legal entity structure (MPAS-v2.md Risk 21) — these drafts
   don't name one, since none is documented yet.
3. Real contact information (a registered address, a real support email) to replace the
   `[NEEDS DECISION]` placeholders.
