-- =============================================================
-- DASHBOARD — Friends / Social setup
-- Run this ONCE in your Supabase project:
--   Supabase dashboard → SQL Editor → New query → paste → Run.
-- It only shares public gamification stats (name, level, XP, streak,
-- theme). Your private logs (mood, finance, etc.) are never exposed.
-- Safe to re-run (uses IF NOT EXISTS / DROP POLICY IF EXISTS).
-- =============================================================

-- ---- PROFILES: one public "card" per user ----
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text unique not null,
  display_name text,
  avatar       text default '🙂',
  level        int  default 1,
  xp           int  default 0,
  xp_week      int  default 0,
  streak       int  default 0,
  skin         text default 'none',
  updated_at   timestamptz default now()
);
alter table public.profiles enable row level security;
-- any signed-in user can read profiles (needed for username search + leaderboard)
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select to authenticated using (true);
-- you can only create/update YOUR OWN profile
drop policy if exists "profiles_write_own" on public.profiles;
create policy "profiles_write_own" on public.profiles
  for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ---- FRIENDSHIPS: requests + accepted friends ----
create table if not exists public.friendships (
  id         bigint generated always as identity primary key,
  requester  uuid not null references auth.users(id) on delete cascade,
  addressee  uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'pending',   -- 'pending' | 'accepted'
  created_at timestamptz default now(),
  unique (requester, addressee)
);
alter table public.friendships enable row level security;
drop policy if exists "fr_read" on public.friendships;
create policy "fr_read" on public.friendships
  for select to authenticated using (auth.uid() = requester or auth.uid() = addressee);
drop policy if exists "fr_insert" on public.friendships;
create policy "fr_insert" on public.friendships
  for insert to authenticated with check (auth.uid() = requester);
drop policy if exists "fr_update" on public.friendships;
create policy "fr_update" on public.friendships
  for update to authenticated using (auth.uid() = requester or auth.uid() = addressee);
drop policy if exists "fr_delete" on public.friendships;
create policy "fr_delete" on public.friendships
  for delete to authenticated using (auth.uid() = requester or auth.uid() = addressee);

-- ---- ACTIVITY FEED: "X reached Level 10", "Y unlocked a badge" ----
create table if not exists public.activity (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text,
  text       text,
  created_at timestamptz default now()
);
alter table public.activity enable row level security;
drop policy if exists "act_read" on public.activity;
create policy "act_read" on public.activity
  for select to authenticated using (true);
drop policy if exists "act_insert_own" on public.activity;
create policy "act_insert_own" on public.activity
  for insert to authenticated with check (auth.uid() = user_id);

-- ---- NUDGES: send a friend a quick 👋 / 🔥 / 💪 ----
create table if not exists public.nudges (
  id         bigint generated always as identity primary key,
  from_id    uuid not null references auth.users(id) on delete cascade,
  to_id      uuid not null references auth.users(id) on delete cascade,
  emoji      text,
  created_at timestamptz default now()
);
alter table public.nudges enable row level security;
drop policy if exists "nd_read" on public.nudges;
create policy "nd_read" on public.nudges
  for select to authenticated using (auth.uid() = to_id or auth.uid() = from_id);
drop policy if exists "nd_insert" on public.nudges;
create policy "nd_insert" on public.nudges
  for insert to authenticated with check (auth.uid() = from_id);
drop policy if exists "nd_delete_mine" on public.nudges;
create policy "nd_delete_mine" on public.nudges
  for delete to authenticated using (auth.uid() = to_id);

-- Done! Reload the app and open the Friends page.
