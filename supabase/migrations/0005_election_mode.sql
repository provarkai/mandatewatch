-- MandateWatch — Slice 5: Election Mode gating.
-- Apply by pasting into the Supabase Dashboard's SQL Editor (Project -> SQL Editor -> New query).
-- Safe to re-run: "create table if not exists" and "drop policy if exists" precede everything,
-- so re-applying after a partial failure won't error out.

-- Single-row settings table. `id boolean primary key default true` plus the check constraint
-- guarantees exactly one row can ever exist -- no risk of the app reading/writing the wrong row.
create table if not exists app_settings (
  id boolean primary key default true check (id),
  election_mode_enabled boolean not null default false
);

insert into app_settings (id, election_mode_enabled)
values (true, false)
on conflict (id) do nothing;

alter table app_settings enable row level security;

drop policy if exists "public read" on app_settings;
create policy "public read" on app_settings for select using (true);
-- Every visitor needs to read this to decide whether to show the Election Watch tab at all.

drop policy if exists "admins update" on app_settings;
create policy "admins update" on app_settings for update
  using (exists (select 1 from admins where user_id = auth.uid()));
-- A plain RLS update policy is enough here (unlike profiles/admins/demands elsewhere in this
-- app) -- this table has exactly one meaningful column and no cross-table side effects to
-- protect, so there's no column-vs-row-level RLS gap to close with a narrower RPC.
