-- Lock down app_state: each signed-in user can only read and change their own
-- rows (keys look like "<user id>:<area>"). Signed-out requests see nothing.
-- Server functions in api/ use the secret key and are not affected.
-- Safe to run more than once. Run in Supabase: SQL Editor -> New query -> Run.

alter table public.app_state enable row level security;

-- Remove whatever policies were there before (they let anyone read).
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'app_state' loop
    execute format('drop policy %I on public.app_state', p.policyname);
  end loop;
end $$;

create policy "own rows: read" on public.app_state
  for select to authenticated
  using (split_part(key, ':', 1) = (select auth.uid())::text);

create policy "own rows: add" on public.app_state
  for insert to authenticated
  with check (split_part(key, ':', 1) = (select auth.uid())::text);

create policy "own rows: change" on public.app_state
  for update to authenticated
  using (split_part(key, ':', 1) = (select auth.uid())::text)
  with check (split_part(key, ':', 1) = (select auth.uid())::text);

create policy "own rows: delete" on public.app_state
  for delete to authenticated
  using (split_part(key, ':', 1) = (select auth.uid())::text);

-- The admin (owner) manages the AI allowlist row from Settings.
create policy "admin: ai allowlist" on public.app_state
  for all to authenticated
  using (key = 'ai:allowlist' and lower((select auth.jwt()) ->> 'email') = 'tomayala55@gmail.com')
  with check (key = 'ai:allowlist' and lower((select auth.jwt()) ->> 'email') = 'tomayala55@gmail.com');

-- Tables only the server touches: no direct access from the app at all.
do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'reminders') then
    execute 'alter table public.reminders enable row level security';
  end if;
  if exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'push_subscriptions') then
    execute 'alter table public.push_subscriptions enable row level security';
  end if;
end $$;

-- Check: should list the five app_state policies above.
select tablename, policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'app_state' order by policyname;
