-- =============================================================
-- Dashboard v3 — safer saving (run ONCE: Supabase → SQL Editor → paste → Run)
-- Safe to run again. No secrets in this file.
--
-- Saving used to send a whole row (your gym, your to-do, …). If another device had
-- changed something a moment before, that change could be overwritten. With this,
-- the app sends only what changed, and the database merges it into the row: every
-- other key stays exactly as it is.
--
-- It runs as the signed-in person ("security invoker"), so the existing rules still
-- apply: you can only ever change your own rows.
-- =============================================================
create or replace function public.app_state_patch(p_key text, p_patch jsonb)
returns void
language sql
security invoker
set search_path = public
as $$
  insert into public.app_state as a (key, data, updated_at)
  values (p_key, p_patch, now())
  on conflict (key) do update
    set data = coalesce(a.data, '{}'::jsonb) || excluded.data,
        updated_at = now();
$$;
revoke all on function public.app_state_patch(text, jsonb) from public, anon;
grant execute on function public.app_state_patch(text, jsonb) to authenticated;

-- Done. The app uses it automatically.
