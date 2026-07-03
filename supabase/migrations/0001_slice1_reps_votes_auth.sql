-- MandateWatch — Backend Slice 1: reference data, representatives, votes, auth profile.
-- Apply by pasting into the Supabase Dashboard's SQL Editor (Project -> SQL Editor -> New query).
-- Safe to re-run: every "create table" uses "if not exists" and every "create policy" is preceded
-- by a matching "drop policy if exists", so re-applying after a partial failure won't error out.

-- ============================================================================
-- 1. Reference tables (seeded once by scripts/seed.mjs, public read-only after)
-- ============================================================================

create table if not exists states (
  code text primary key,           -- 'Lagos', 'FCT', etc.
  region text not null              -- North Central | North East | ... | South West
);

create table if not exists lgas (
  id serial primary key,
  name text not null,
  state_code text references states(code),
  unique (name, state_code)
);

create table if not exists senatorial_districts (
  id serial primary key,
  state_code text references states(code),
  name text not null,
  lgas text[] not null,              -- array of lga names composing this district
  unique (state_code, name)
);

create table if not exists federal_constituencies (
  id serial primary key,
  state_code text references states(code),
  name text not null,
  lgas text[] not null,
  unique (state_code, name)
);

create table if not exists state_constituencies (
  id serial primary key,
  state_code text references states(code),
  name text not null,
  lgas text[],                       -- nullable — some constituencies don't resolve to LGAs
  unique (state_code, name)
);

create table if not exists parties (
  code text primary key,             -- 'APC', 'PDP', 'LP', etc.
  name text not null,
  logo_url text,
  color_hex text not null
);

-- ============================================================================
-- 2. Core entities for this slice
-- ============================================================================

-- NOTE: chamber values are the frontend's exact literal strings (App.jsx's CHAMBER_INFO /
-- PHASE1_CHAMBERS), not lowercase/snake_case — the UI does exact string comparisons
-- (rep.chamber === "Senate", etc.) throughout, so seeding anything else would silently break it.
create table if not exists representatives (
  id serial primary key,             -- seed script inserts explicit ids from the prototype's REPS
                                      -- array, then advances this sequence past the max seeded id
                                      -- so future (e.g. admin-panel) inserts don't collide
  name text not null,
  chamber text not null check (chamber in ('President','Governor','Senate','House of Reps','State Assembly','LG Chairman','Councilor')),
  state_code text references states(code),
  constituency text not null,        -- senatorial district / federal constituency / state constituency name
  lga text,                          -- best-guess home LGA; not a precise boundary match
  town text,
  party_code text references parties(code),
  photo_url text,
  role text,                         -- 'Senate President', 'Speaker', etc. — nullable, leadership only
  elected_year int,
  term_start int,
  term_end int,
  term_number text,
  claimed_by uuid references auth.users(id),  -- null until claimed & verified (later slice)
  claimed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists rep_scores (
  rep_id integer references representatives(id) primary key,
  approval_up int not null default 0,
  approval_down int not null default 0,
  presence_up int not null default 0,
  presence_down int not null default 0
);
-- Display percentage = approval_up / (approval_up + approval_down), same for presence.
-- Kept as a separate table so vote writes don't lock the representatives row other readers
-- are hitting constantly. Mutated ONLY by the bump_rep_score() trigger below — never directly
-- writable by the client, since nothing would stop a malicious client from setting counts to
-- anything if it could UPDATE this table itself.

create table if not exists rep_votes (
  id bigserial primary key,
  rep_id integer references representatives(id),
  user_id uuid references auth.users(id),
  field text not null check (field in ('approval','presence')),
  direction text not null check (direction in ('up','down')),
  created_at timestamptz default now(),
  unique (rep_id, user_id, field)     -- enforces one vote per rep per metric per user
);

create table if not exists profiles (
  id uuid primary key references auth.users(id),
  name text not null,                -- full name or initials, shown publicly on demands filed
  phone text,                        -- collected + validated (11-digit NG format) at signup
  state_code text references states(code),
  lga text,
  is_nin_verified boolean default false,  -- placeholder for a later NIN-verification integration
  created_at timestamptz default now()
);

-- ============================================================================
-- 3. Row-Level Security
-- ============================================================================

alter table states enable row level security;
alter table lgas enable row level security;
alter table senatorial_districts enable row level security;
alter table federal_constituencies enable row level security;
alter table state_constituencies enable row level security;
alter table parties enable row level security;
alter table representatives enable row level security;
alter table rep_scores enable row level security;
alter table rep_votes enable row level security;
alter table profiles enable row level security;

-- Reference tables + representatives + rep_scores: public read, no client write at all
-- (reference/rep data is seeded via the service-role key, which bypasses RLS entirely —
-- a deliberately separate, higher-privilege path, never exposed to the browser).
drop policy if exists "public read" on states;
create policy "public read" on states for select using (true);

drop policy if exists "public read" on lgas;
create policy "public read" on lgas for select using (true);

drop policy if exists "public read" on senatorial_districts;
create policy "public read" on senatorial_districts for select using (true);

drop policy if exists "public read" on federal_constituencies;
create policy "public read" on federal_constituencies for select using (true);

drop policy if exists "public read" on state_constituencies;
create policy "public read" on state_constituencies for select using (true);

drop policy if exists "public read" on parties;
create policy "public read" on parties for select using (true);

drop policy if exists "public read" on representatives;
create policy "public read" on representatives for select using (true);

drop policy if exists "public read" on rep_scores;
create policy "public read" on rep_scores for select using (true);
-- Intentionally no insert/update/delete policy on rep_scores — see trigger below.

-- rep_votes: a user can insert their own vote and read back their own votes (needed to show
-- "already voted" after a page reload, not just within one session) — no update/delete, votes
-- are final, matching the one-shot voting UI.
drop policy if exists "insert own vote" on rep_votes;
create policy "insert own vote" on rep_votes for insert with check (auth.uid() = user_id);

drop policy if exists "read own votes" on rep_votes;
create policy "read own votes" on rep_votes for select using (auth.uid() = user_id);

-- profiles: a user can read/insert/update only their own row.
drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles for select using (auth.uid() = id);

drop policy if exists "insert own profile" on profiles;
create policy "insert own profile" on profiles for insert with check (auth.uid() = id);

drop policy if exists "update own profile" on profiles;
create policy "update own profile" on profiles for update using (auth.uid() = id);

-- ============================================================================
-- 4. rep_scores mutation trigger — the mechanism that makes votes real
-- ============================================================================

create or replace function bump_rep_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into rep_scores (rep_id) values (new.rep_id) on conflict (rep_id) do nothing;

  if new.field = 'approval' and new.direction = 'up' then
    update rep_scores set approval_up = approval_up + 1 where rep_id = new.rep_id;
  elsif new.field = 'approval' then
    update rep_scores set approval_down = approval_down + 1 where rep_id = new.rep_id;
  elsif new.field = 'presence' and new.direction = 'up' then
    update rep_scores set presence_up = presence_up + 1 where rep_id = new.rep_id;
  else
    update rep_scores set presence_down = presence_down + 1 where rep_id = new.rep_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bump_rep_score on rep_votes;
create trigger trg_bump_rep_score
  after insert on rep_votes
  for each row execute function bump_rep_score();

-- ============================================================================
-- 5. Seed-script helper — advances the representatives id sequence past the max
--    explicitly-seeded id, so future serial-default inserts don't collide with them.
--    security definer because the seed script runs with the service-role key, which can
--    call this directly; kept as a narrow, single-purpose function rather than granting
--    broader sequence-manipulation rights.
-- ============================================================================

create or replace function setval_representatives_id_seq(new_value integer)
returns void
language sql
security definer
set search_path = public
as $$
  select setval('representatives_id_seq', new_value);
$$;
