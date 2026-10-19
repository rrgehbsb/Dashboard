-- =============================================================
-- Dashboard v3 — friends v4: choose who sees what, unique usernames, notifications
-- Run ONCE: Supabase → SQL Editor → New query → paste → Run. Safe to run again.
--
-- The copy to paste is supabase/friends-v4.local.sql on the owner's computer: the
-- same file with the real scheduler secret filled in. That copy is never committed
-- (the repository is public), and this one keeps <CRON_SECRET> as a placeholder.
-- =============================================================

-- ---- 1. usernames: one per person, capitals don't make a different name ----
do $$ begin
  create unique index if not exists profiles_username_lower on public.profiles (lower(username));
exception when unique_violation then
  raise notice 'Two profiles have the same username in different capitals. Rename one, then run this again.';
end $$;

-- ---- 2. your trip: everyone, or only the friends you pick ----
-- trip_to = null → all your friends; a list → only those friends
alter table public.presence add column if not exists trip_to uuid[];
drop policy if exists "presence_friends_read" on public.presence;
create policy "presence_friends_read" on public.presence
  for select to authenticated using (
    (trip_to is null or auth.uid() = any (trip_to))
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = auth.uid() and f.addressee = presence.user_id)
          or (f.addressee = auth.uid() and f.requester = presence.user_id))
    )
  );
-- location moves to its own table, so it can go to fewer friends than your trip
alter table public.presence drop column if exists lat;
alter table public.presence drop column if exists lng;
alter table public.presence drop column if exists loc_at;

-- ---- 3. your location: only the friends you pick (share_to) ----
create table if not exists public.locations (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  lat        double precision,
  lng        double precision,
  loc_at     timestamptz,
  share_to   uuid[] not null default '{}',
  updated_at timestamptz default now()
);
alter table public.locations enable row level security;
drop policy if exists "locations_own" on public.locations;
create policy "locations_own" on public.locations
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "locations_picked_friends_read" on public.locations;
create policy "locations_picked_friends_read" on public.locations
  for select to authenticated using (
    auth.uid() = any (share_to)
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester = auth.uid() and f.addressee = locations.user_id)
          or (f.addressee = auth.uid() and f.requester = locations.user_id))
    )
  );
revoke all on public.locations from anon;

-- ---- 4. notifications ----
-- each phone that turned notifications on (only you can see or change yours)
create table if not exists public.push_subs (
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now(),
  primary key (user_id, endpoint)
);
alter table public.push_subs enable row level security;
drop policy if exists "push_subs_own" on public.push_subs;
create policy "push_subs_own" on public.push_subs
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.push_subs from anon;

-- what you want to hear about: which friends, which moments, timetable changes
create table if not exists public.notify_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  friends    uuid[] not null default '{}',
  moments    text[] not null default '{leave,station,arrive}',
  timetable  boolean not null default false,
  updated_at timestamptz default now()
);
alter table public.notify_prefs enable row level security;
drop policy if exists "notify_prefs_own" on public.notify_prefs;
create policy "notify_prefs_own" on public.notify_prefs
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.notify_prefs from anon;

-- what was already sent (so nothing is sent twice); only the server uses it
create table if not exists public.notify_log (
  key text primary key,
  at  timestamptz default now()
);
alter table public.notify_log enable row level security;
revoke all on public.notify_log from anon, authenticated;

-- ---- 5. every minute, the app's server sends whatever is due ----
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('dash-notify', '* * * * *', $job$
  select net.http_post(
    url := 'https://y-tdashh1-black.vercel.app/api/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <CRON_SECRET>'),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$job$);
-- forget old "already sent" entries every night
select cron.schedule('dash-notify-clean', '17 3 * * *', $job$
  delete from public.notify_log where at < now() - interval '3 days';
$job$);

-- Done. Reload the app: Settings → Friends → Notifications → Turn on.
