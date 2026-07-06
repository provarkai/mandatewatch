-- MandateWatch — Stewardship goes real (deferred at Slice 4).
-- Apply by pasting into the Supabase Dashboard's SQL Editor (Project -> SQL Editor -> New query).
-- Structural mirror of demands/demand_upvotes (migration 0002) and threads/thread_votes
-- (migration 0003) -- same public-read + insert-your-own + verification-trigger pattern.

create table if not exists stewardship_entries (
  id bigserial primary key,
  rep_id integer references representatives(id) not null,
  title text not null,
  description text,
  verified_count int not null default 0,
  created_at timestamptz default now()
);
-- verified_count is mutated ONLY by the bump_stewardship_verified_count() trigger below -- never
-- directly writable by the client, same reasoning as rep_scores/demands.upvotes elsewhere.

create table if not exists stewardship_verifications (
  id bigserial primary key,
  entry_id bigint references stewardship_entries(id),
  user_id uuid references auth.users(id),
  created_at timestamptz default now(),
  unique (entry_id, user_id)   -- enforces one verification per entry per user
);

alter table stewardship_entries enable row level security;
alter table stewardship_verifications enable row level security;

drop policy if exists "public read" on stewardship_entries;
create policy "public read" on stewardship_entries for select using (true);

drop policy if exists "claimed rep can post" on stewardship_entries;
create policy "claimed rep can post" on stewardship_entries for insert
  with check (
    exists (select 1 from representatives r where r.id = rep_id and r.claimed_by = auth.uid())
  );
-- A direct RLS check, not an RPC, since posting doesn't mutate any other table -- unlike
-- approve_rep_claim, there's no cross-table side effect here to centralize.
-- No update/delete policy -- entries are immutable once posted, matching the "no take-backs"
-- pattern already applied to rep_votes/demands/comments.

drop policy if exists "insert own verification" on stewardship_verifications;
create policy "insert own verification" on stewardship_verifications for insert
  with check (auth.uid() = user_id);

drop policy if exists "read own verifications" on stewardship_verifications;
create policy "read own verifications" on stewardship_verifications for select
  using (auth.uid() = user_id);
-- Needed to hydrate "already verified" state after a page reload, not just within one session.

create or replace function bump_stewardship_verified_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update stewardship_entries set verified_count = verified_count + 1 where id = new.entry_id;
  return new;
end;
$$;

drop trigger if exists trg_bump_stewardship_verified_count on stewardship_verifications;
create trigger trg_bump_stewardship_verified_count
  after insert on stewardship_verifications
  for each row execute function bump_stewardship_verified_count();
