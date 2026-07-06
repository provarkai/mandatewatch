-- MandateWatch — Admin toggle for launch_states (follow-up to 0007_pilot_launch_states.sql).
-- Apply by pasting into the Supabase Dashboard's SQL Editor (Project -> SQL Editor -> New query).

-- Seed every real state into launch_states (defaulting to disabled) so the Admin panel has a full,
-- toggleable list rather than only the 6 states migration 0007 explicitly enabled. Existing rows
-- (the 6 pilot states) are untouched -- "do nothing" on conflict, not an overwrite.
insert into launch_states (state_code, participation_enabled)
select code, false from states
on conflict (state_code) do nothing;

-- Admins can flip participation_enabled directly. A plain RLS update policy is sufficient here
-- (same reasoning as app_settings in migration 0005) -- this table has exactly one meaningful
-- column and no cross-table side effects, so there's no column-vs-row-level RLS gap to close with
-- a narrower RPC.
drop policy if exists "admins update" on launch_states;
create policy "admins update" on launch_states for update
  using (exists (select 1 from admins where user_id = auth.uid()));
