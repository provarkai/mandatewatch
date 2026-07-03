-- MandateWatch — Backend Slice 3: Discussion (threads + comments).
-- Apply by pasting into the Supabase Dashboard's SQL Editor (Project -> SQL Editor -> New query).
-- Safe to re-run: every "create table" uses "if not exists" and every "create policy" is preceded
-- by a matching "drop policy if exists", so re-applying after a partial failure won't error out.

-- ============================================================================
-- 1. Threads
-- ============================================================================

-- author_name is snapshotted from the poster's profile at insert time, same reasoning as
-- demands.submitted_by_name in migration 0002 -- avoids joining `profiles`, which stays private.
create table if not exists threads (
  id bigserial primary key,
  rep_id integer references representatives(id),
  issue_tag text,
  title text not null,
  body text not null,
  user_id uuid references auth.users(id) not null,
  author_name text not null,
  score int not null default 0,
  created_at timestamptz default now(),
  check (num_nonnulls(rep_id, issue_tag) = 1)   -- exactly one -- matches NewThreadModal's "About a
                                                 -- rep" vs. "About an issue" toggle
);
-- score is mutated ONLY by the bump_thread_score() trigger below -- never directly writable by
-- the client, same reasoning as rep_scores / demands.upvotes.

create table if not exists thread_votes (
  id bigserial primary key,
  thread_id bigint references threads(id),
  user_id uuid references auth.users(id),
  direction text not null check (direction in ('up','down')),
  created_at timestamptz default now(),
  unique (thread_id, user_id)   -- enforces one vote per thread per user
);

-- ============================================================================
-- 2. Comments
-- ============================================================================

create table if not exists comments (
  id bigserial primary key,
  thread_id bigint references threads(id) not null,
  parent_id bigint references comments(id),   -- null for a top-level comment
  user_id uuid references auth.users(id) not null,
  author_name text not null,
  body text not null,
  is_official boolean not null default false,
  -- Real rep verification is a later slice ("Rep claims"). Until it exists, is_official is forced
  -- false by the RLS insert policy below (not just left unset by the client) -- otherwise today's
  -- fake, local-only "Claim & Verify This Profile (DEMO)" button would let anyone post a
  -- server-persisted, everyone-sees-it "Official Response" badge just by clicking a demo button.
  score int not null default 0,
  created_at timestamptz default now()
);

create table if not exists comment_votes (
  id bigserial primary key,
  comment_id bigint references comments(id),
  user_id uuid references auth.users(id),
  direction text not null check (direction in ('up','down')),
  created_at timestamptz default now(),
  unique (comment_id, user_id)
);

-- ============================================================================
-- 3. Row-Level Security
-- ============================================================================

alter table threads enable row level security;
alter table thread_votes enable row level security;
alter table comments enable row level security;
alter table comment_votes enable row level security;

drop policy if exists "public read" on threads;
create policy "public read" on threads for select using (true);

drop policy if exists "insert own thread" on threads;
create policy "insert own thread" on threads for insert with check (auth.uid() = user_id);
-- No update/delete policy -- threads are immutable from the client once posted, same "votes are
-- final" reasoning already applied to rep_votes / demands.

drop policy if exists "insert own thread vote" on thread_votes;
create policy "insert own thread vote" on thread_votes for insert with check (auth.uid() = user_id);

drop policy if exists "read own thread votes" on thread_votes;
create policy "read own thread votes" on thread_votes for select using (auth.uid() = user_id);

drop policy if exists "public read" on comments;
create policy "public read" on comments for select using (true);

drop policy if exists "insert own comment" on comments;
create policy "insert own comment" on comments for insert
  with check (auth.uid() = user_id and is_official = false);

drop policy if exists "insert own comment vote" on comment_votes;
create policy "insert own comment vote" on comment_votes for insert with check (auth.uid() = user_id);

drop policy if exists "read own comment votes" on comment_votes;
create policy "read own comment votes" on comment_votes for select using (auth.uid() = user_id);

-- ============================================================================
-- 4. Triggers -- the mechanism that makes votes real
-- ============================================================================

create or replace function bump_thread_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update threads set score = score + case when new.direction = 'up' then 1 else -1 end
    where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_thread_score on thread_votes;
create trigger trg_bump_thread_score
  after insert on thread_votes
  for each row execute function bump_thread_score();

-- Auto-inserts the author's own "up" vote when a thread is created, reproducing the old
-- prototype's "starts at 1" behavior server-side, same pattern as seed_demand_self_upvote() in 0002.
create or replace function seed_thread_self_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into thread_votes (thread_id, user_id, direction) values (new.id, new.user_id, 'up');
  return new;
end;
$$;

drop trigger if exists trg_seed_thread_self_vote on threads;
create trigger trg_seed_thread_self_vote
  after insert on threads
  for each row execute function seed_thread_self_vote();

create or replace function bump_comment_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update comments set score = score + case when new.direction = 'up' then 1 else -1 end
    where id = new.comment_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_comment_score on comment_votes;
create trigger trg_bump_comment_score
  after insert on comment_votes
  for each row execute function bump_comment_score();

create or replace function seed_comment_self_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into comment_votes (comment_id, user_id, direction) values (new.id, new.user_id, 'up');
  return new;
end;
$$;

drop trigger if exists trg_seed_comment_self_vote on comments;
create trigger trg_seed_comment_self_vote
  after insert on comments
  for each row execute function seed_comment_self_vote();
