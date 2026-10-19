-- =============================================================
-- Dashboard v3 — friends, trip sharing and location (run ONCE)
-- Supabase → SQL Editor → New query → paste all of this → Run.
-- Safe to run again.
--
-- 1. Fixes friend requests: only the person who RECEIVES a request can
--    accept it (before, the sender could mark it accepted by themselves).
-- 2. Adds "presence": your shared trip plan and, only if you switch it on,
--    your last location. Only friends you accepted can read it, and you
--    can only write your own.
-- =============================================================

-- ---- profiles (already exist; make sure the columns the app uses are there) ----
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar text default '🙂';
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- ---- friendships: consent-safe rules ----
-- send: only as yourself, only as a pending request, never to yourself
drop policy if exists "fr_insert" on public.friendships;
create policy "fr_insert" on public.friendships
  for insert to authenticated
  with check (auth.uid() = requester and status = 'pending' and requester <> addressee);
-- accept: only the person who received the request
drop policy if exists "fr_update" on public.friendships;
create policy "fr_update" on public.friendships
  for update to authenticated
  using (auth.uid() = addressee)
  with check (auth.uid() = addressee and status = 'accepted');
-- an update can only change the status, never who the request is between
revoke update on public.friendships from authenticated, anon;
grant update (status) on public.friendships to authenticated;
-- read / remove: either person (unchanged)
drop policy if exists "fr_read" on public.friendships;
create policy "fr_read" on public.friendships
  for select to authenticated using (auth.uid() = requester or auth.uid() = addressee);
drop policy if exists "fr_delete" on public.friendships;
create policy "fr_delete" on public.friendships
  for delete to authenticated using (auth.uid() = requester or auth.uid() = addressee);

-- ---- presence: shared trip + optional location ----
create table if not exists public.presence (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  trip       jsonb,             -- today's (or tomorrow's) planned trip, times only
  lat        double precision,  -- last location, only when "Share my location" is on
  lng        double precision,
  loc_at     timestamptz,
  updated_at timestamptz default now()
);
alter table public.presence enable row level security;
drop policy if exists "presence_own" on public.presence;
create policy "presence_own" on public.presence
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "presence_friends_read" on public.presence;
create policy "presence_friends_read" on public.presence
  for select to authenticated using (
    exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = auth.uid() and f.addressee = presence.user_id)
          or (f.addressee = auth.uid() and f.requester = presence.user_id))
    )
  );
revoke all on public.presence from anon;

-- Done. Reload the app: Settings → Friends.
