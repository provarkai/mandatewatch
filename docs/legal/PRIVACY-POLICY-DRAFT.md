# MandateWatch Privacy Policy (DRAFT — not legally reviewed, do not publish)

> **This is a draft for legal review, not a published policy.** See `docs/legal/README.md`.
> Written against the real MandateWatch schema and data flows as of this draft — not generic
> template language — so a reviewing lawyer is correcting real practice, not guessing at it.

Last updated: [NEEDS DECISION — set on actual publication]

## 1. What this policy covers

This policy describes what personal information MandateWatch ("we," "the platform") collects when
you use mandatewatch.vercel.app [NEEDS DECISION — final production domain], why, and who else can
see it.

## 2. What we collect

### 2.1 When you sign in
We use email-based "magic link" sign-in (via Supabase Auth). We receive your **email address**.
We do not receive or store a password — there isn't one.

### 2.2 When you complete your profile
After your first sign-in, we ask for:
- **Name** (or initials, if you'd rather not share your full name) — shown publicly on any demand
  or discussion post you make.
- **Phone number** — validated as an 11-digit Nigerian number. **Never shown publicly anywhere.**
  Collected to support one-person-one-action integrity, not displayed on your profile or on your
  posts.
- **State and Local Government Area (LGA)** — used to determine which representatives you can file
  a demand against (your own state only) and to show alongside content you post publicly (e.g.
  "Filed by J.D. · Ikeja LGA").

### 2.3 When you take an action on the platform
- **Voting** (approval/presence ratings on a representative, upvoting a demand or a discussion
  post): we record that you voted, tied to your account, to enforce one vote per person per item.
  Individual votes are never shown to other users — only the aggregate count.
- **Filing a demand or posting in Discussion**: the title/body text you write, plus your name (or
  initials) and LGA as configured in your profile, are shown publicly, attributed to you.
- **Claiming a representative's profile**: if you submit a claim to be recognized as a verified
  representative, we collect your name, email, and a written justification. This is reviewed by an
  administrator and is **not shown publicly** — only the outcome (approved/rejected) affects what's
  visible.
- **Newsletter signup**: just an email address, used only to send the updates you signed up for.

### 2.4 What we do not collect
We do not collect your National Identification Number (NIN), government ID, or any other
sensitive identity document today. [If NIN-based verification is built in the future, this section
must be rewritten — see MPAS-v2.md §16.3.]

## 3. Who can see what

| Data | Visible to |
|---|---|
| Your email, phone number | Only you, and MandateWatch administrators for account support |
| Your name/initials, state, LGA | Public, but only on content you choose to post (a demand, a comment, a discussion thread) — not displayed as a standalone public profile |
| Your votes (which reps, which demands you supported) | Only you — shown to you as "already voted"; never shown to other users individually |
| Your rep-claim justification | Only you and administrators reviewing the claim |
| Content you post (demands, comments, threads) | Public, to anyone visiting the platform |

## 4. Where your data is stored

MandateWatch is built on **Supabase** (database, authentication) and hosted on **Vercel**
(application hosting). Both are third-party infrastructure providers who process data on our
behalf under their own security and data-processing terms. We do not run our own servers.
[NEEDS LEGAL INPUT — confirm what disclosure Nigerian data protection law requires for this kind
of sub-processor arrangement, and whether either provider's data residency needs to be disclosed
specifically.]

## 5. What we never do

- We never sell your personal data to anyone, for any reason.
- We never sell political advertising, and no political party, candidate, or officeholder can pay
  for different treatment of their data or visibility on the platform.
- We never use your data to train AI models without a separate, explicit policy update disclosing
  that change first.

## 6. Your rights

[NEEDS LEGAL INPUT — this section must be written against the Nigeria Data Protection Act (NDPA)
specifically: right to access, correct, or delete your data; how to exercise these rights; response
timeframes. Do not publish a generic "GDPR-style" rights list without confirming it matches actual
Nigerian legal requirements.]

## 7. Data retention

Your account and profile data is retained while your account is active. If you delete your
account, [NEEDS DECISION — what happens to content you've already posted publicly: is it removed,
anonymized, or does it remain attributed to your (now-deleted) account? This is a real product
decision, not just a legal one, and should be made deliberately — see MPAS-v2.md §10.5 on soft
deletion].

## 8. Children's privacy

[NEEDS DECISION — MandateWatch has no stated minimum age today. This needs an explicit decision,
likely aligned with voting-age or a standard minimum (e.g. 13, matching common international
practice), before publication.]

## 9. Changes to this policy

[NEEDS DECISION — commit to a notification method for material changes, e.g. a banner on the site
or an email to registered users, consistent with the transparency principle already established
for the product more broadly (see CLAUDE.md).]

## 10. Contact

[NEEDS DECISION — a real contact email/address once MandateWatch's legal entity structure (MPAS-v2.md
Risk 21) is resolved.]
