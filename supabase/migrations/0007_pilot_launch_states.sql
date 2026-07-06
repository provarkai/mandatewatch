-- MandateWatch — Pilot-state participation gating.
-- Apply by pasting into the Supabase Dashboard's SQL Editor (Project -> SQL Editor -> New query).
-- Safe to re-run: "create table if not exists" and "drop policy if exists" precede everything.

-- ============================================================================
-- 1. launch_states — the single source of truth for which states can currently
--    participate (file demands, post in discussion). Representative *information* stays
--    national regardless of this table; only Participation-module writes are gated by it.
-- ============================================================================

create table if not exists launch_states (
  state_code text primary key references states(code),
  participation_enabled boolean not null default false
);

insert into launch_states (state_code, participation_enabled) values
  ('Lagos', true), ('Ogun', true), ('Rivers', true),
  ('Kano', true), ('Abia', true), ('Edo', true)
on conflict (state_code) do update set participation_enabled = excluded.participation_enabled;

alter table launch_states enable row level security;

drop policy if exists "public read" on launch_states;
create policy "public read" on launch_states for select using (true);
-- No client insert/update/delete policy -- graduating a state is a deliberate admin action done
-- via the SQL Editor for now (same bootstrap pattern as the `admins` table), not a client write.

-- ============================================================================
-- 2. Extend the existing insert policies on demands/threads/comments with a launch-state
--    check on the POSTER's own state (not the target rep's state) -- these are edits to the
--    existing policies, not additional ones: Postgres ORs multiple permissive policies
--    together, so a second policy would add an alternative path, not a restriction.
-- ============================================================================

drop policy if exists "insert own demand" on demands;
create policy "insert own demand" on demands for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from profiles p
      join launch_states ls on ls.state_code = p.state_code
      where p.id = auth.uid() and ls.participation_enabled
    )
  );

drop policy if exists "insert own thread" on threads;
create policy "insert own thread" on threads for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from profiles p
      join launch_states ls on ls.state_code = p.state_code
      where p.id = auth.uid() and ls.participation_enabled
    )
  );

drop policy if exists "insert own comment" on comments;
create policy "insert own comment" on comments for insert
  with check (
    auth.uid() = user_id and is_official = false
    and exists (
      select 1 from profiles p
      join launch_states ls on ls.state_code = p.state_code
      where p.id = auth.uid() and ls.participation_enabled
    )
  );
