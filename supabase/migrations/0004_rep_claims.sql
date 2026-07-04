-- MandateWatch — Backend Slice 4: Rep Claims (admin-reviewed).
-- Apply by pasting into the Supabase Dashboard's SQL Editor (Project -> SQL Editor -> New query).
-- Safe to re-run: every "create table" uses "if not exists" and every "create policy" is preceded
-- by a matching "drop policy if exists", so re-applying after a partial failure won't error out.

-- ============================================================================
-- 1. Claim requests
-- ============================================================================

-- requester_name / requester_email are snapshotted at insert time, same reasoning as
-- demands.submitted_by_name in migration 0002 -- lets the admin review UI show who's asking
-- without joining `profiles`, which stays select-own-row-only.
create table if not exists rep_claim_requests (
  id bigserial primary key,
  rep_id integer references representatives(id) not null,
  user_id uuid references auth.users(id) not null,
  requester_name text not null,
  requester_email text not null,
  justification text not null,   -- claimant explains how to verify them: official email, social
                                  -- handle, phone, etc. -- there's no ID-verification API here, so
                                  -- this is what the admin reviews manually
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);

-- One PENDING request per user per rep, not a blanket unique constraint -- lets a rejected
-- claimant submit again later (e.g. with better proof) instead of being permanently locked out,
-- while still preventing duplicate simultaneous pending requests.
drop index if exists rep_claim_requests_one_pending;
create unique index rep_claim_requests_one_pending on rep_claim_requests (rep_id, user_id)
  where status = 'pending';

alter table rep_claim_requests enable row level security;

drop policy if exists "read own requests" on rep_claim_requests;
create policy "read own requests" on rep_claim_requests for select using (auth.uid() = user_id);

drop policy if exists "admins read all requests" on rep_claim_requests;
create policy "admins read all requests" on rep_claim_requests for select
  using (exists (select 1 from admins where user_id = auth.uid()));
-- Postgres ORs multiple permissive select policies together, so a regular user sees their own
-- rows via the first policy and an admin additionally sees every row via this one.

drop policy if exists "insert own request" on rep_claim_requests;
create policy "insert own request" on rep_claim_requests for insert
  with check (auth.uid() = user_id and status = 'pending');
-- No update/delete policy for any client role -- every status transition goes through the
-- approve_rep_claim() / reject_rep_claim() functions below instead, which run as the table owner
-- and check admin membership themselves.

-- ============================================================================
-- 2. Approve / reject -- the only path that can ever set representatives.claimed_by
-- ============================================================================

create or replace function approve_rep_claim(request_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req rep_claim_requests%rowtype;
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  select * into req from rep_claim_requests where id = request_id;
  if not found then
    raise exception 'claim request not found';
  end if;
  if req.status <> 'pending' then
    raise exception 'claim request already resolved';
  end if;
  if exists (select 1 from representatives where id = req.rep_id and claimed_by is not null) then
    raise exception 'representative already claimed';
  end if;

  update rep_claim_requests set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
    where id = request_id;
  update representatives set claimed_by = req.user_id, claimed_at = now() where id = req.rep_id;

  -- Any other still-pending requests for the same rep are now moot -- a rep can only be claimed once.
  update rep_claim_requests set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
    where rep_id = req.rep_id and status = 'pending';
end;
$$;

create or replace function reject_rep_claim(request_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from admins where user_id = auth.uid()) then
    raise exception 'not authorized';
  end if;

  update rep_claim_requests set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
    where id = request_id and status = 'pending';
end;
$$;

-- ============================================================================
-- 3. Acknowledge / mark delivered -- the thing Slice 2 deferred until claims were real
-- ============================================================================

-- A narrow RPC rather than a raw RLS update policy on `demands` (same reasoning as the two
-- functions above) -- this only ever touches the `status` column, and only for the rep the
-- caller actually has claimed.
create or replace function acknowledge_demand(demand_id bigint, new_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d demands%rowtype;
begin
  if new_status not in ('acknowledged','delivered') then
    raise exception 'invalid status';
  end if;

  select * into d from demands where id = demand_id;
  if not found then
    raise exception 'demand not found';
  end if;

  if not exists (select 1 from representatives where id = d.rep_id and claimed_by = auth.uid()) then
    raise exception 'not authorized';
  end if;

  update demands set status = new_status where id = demand_id;
end;
$$;
