-- MandateWatch — Slice 1C: Newsletter signup capture.
-- Apply by pasting into the Supabase Dashboard's SQL Editor (Project -> SQL Editor -> New query).
-- Safe to re-run: "create table if not exists" and "drop policy if exists" precede everything.

create table if not exists newsletter_signups (
  id bigserial primary key,
  email text not null unique,
  created_at timestamptz default now()
);

alter table newsletter_signups enable row level security;

drop policy if exists "public insert" on newsletter_signups;
create policy "public insert" on newsletter_signups for insert with check (true);
-- Anyone can submit their email to join the list -- a normal newsletter signup, no auth required,
-- no PII beyond the email itself.

drop policy if exists "admins read" on newsletter_signups;
create policy "admins read" on newsletter_signups for select
  using (exists (select 1 from admins where user_id = auth.uid()));
-- Only admins can read the list -- same admins-table check used throughout this app. No in-app
-- admin UI to browse/export it yet; view it directly via the Supabase Table Editor for now.
