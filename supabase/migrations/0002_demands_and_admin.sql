-- MandateWatch — Backend Slice 2: Demands Board + admin allowlist.
-- Apply by pasting into the Supabase Dashboard's SQL Editor (Project -> SQL Editor -> New query).
-- Safe to re-run: every "create table" uses "if not exists" and every "create policy" is preceded
-- by a matching "drop policy if exists", so re-applying after a partial failure won't error out.

-- ============================================================================
-- 1. Demands Board
-- ============================================================================

-- submitted_by_name / submitted_by_lga are snapshotted from the filer's profile at insert time,
-- not joined from `profiles` at read time -- `profiles` RLS only allows reading your own row (see
-- migration 0001), and that row also holds `phone`, which was deliberately kept private. Denormalizing
-- the two public-safe fields here avoids ever having to loosen that policy.
create table if not exists demands (
  id bigserial primary key,
  rep_id integer references representatives(id),
  user_id uuid references auth.users(id) not null,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open','acknowledged','delivered')),
  submitted_by_name text not null,
  submitted_by_lga text,
  upvotes int not null default 0,
  created_at timestamptz default now()
);
-- upvotes is mutated ONLY by the bump_demand_upvotes() trigger below -- never directly writable by
-- the client, same reasoning as rep_scores in migration 0001.

create table if not exists demand_upvotes (
  id bigserial primary key,
  demand_id bigint references demands(id),
  user_id uuid references auth.users(id),
  created_at timestamptz default now(),
  unique (demand_id, user_id)   -- enforces one upvote per demand per user
);

-- ============================================================================
-- 2. Admin allowlist
-- ============================================================================

-- Deliberately a separate table, not a boolean column on `profiles`. `profiles` already has an
-- "update own row" policy with no column-level restriction (Postgres RLS is row-level, not
-- column-level) -- an `is_admin` column there would let any signed-in user grant themselves admin
-- via a normal `update profiles` call. This table has no insert/update/delete policy for any client
-- role at all; only the project owner, via the SQL Editor (service-role access), can add a row.
create table if not exists admins (
  user_id uuid primary key references auth.users(id),
  created_at timestamptz default now()
);

-- ============================================================================
-- 3. Row-Level Security
-- ============================================================================

alter table demands enable row level security;
alter table demand_upvotes enable row level security;
alter table admins enable row level security;

drop policy if exists "public read" on demands;
create policy "public read" on demands for select using (true);

drop policy if exists "insert own demand" on demands;
create policy "insert own demand" on demands for insert with check (auth.uid() = user_id);
-- No update/delete policy -- demands are immutable from the client once filed, same "votes are
-- final" reasoning already applied to rep_votes in migration 0001.

drop policy if exists "insert own upvote" on demand_upvotes;
create policy "insert own upvote" on demand_upvotes for insert with check (auth.uid() = user_id);

drop policy if exists "read own upvotes" on demand_upvotes;
create policy "read own upvotes" on demand_upvotes for select using (auth.uid() = user_id);
-- Needed to hydrate "already upvoted" state after a page reload, not just within one session.

drop policy if exists "read own admin row" on admins;
create policy "read own admin row" on admins for select using (auth.uid() = user_id);
-- Intentionally no insert/update/delete policy at all -- see comment on the table above.

-- ============================================================================
-- 4. Triggers -- the mechanism that makes upvotes real
-- ============================================================================

create or replace function bump_demand_upvotes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update demands set upvotes = upvotes + 1 where id = new.demand_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_demand_upvotes on demand_upvotes;
create trigger trg_bump_demand_upvotes
  after insert on demand_upvotes
  for each row execute function bump_demand_upvotes();

-- Auto-inserts the filer's own upvote row when a demand is created, reproducing the old
-- prototype's "starts at 1 upvote" behavior server-side instead of a second client round-trip.
-- security definer so this insert isn't blocked by demand_upvotes' own RLS check -- though in
-- practice auth.uid() still equals new.user_id here anyway, since both actions happen in the same
-- request from the same signed-in filer.
create or replace function seed_demand_self_upvote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into demand_upvotes (demand_id, user_id) values (new.id, new.user_id);
  return new;
end;
$$;

drop trigger if exists trg_seed_demand_self_upvote on demands;
create trigger trg_seed_demand_self_upvote
  after insert on demands
  for each row execute function seed_demand_self_upvote();
