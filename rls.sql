-- ============================================================================
-- UniAI — Row Level Security (run in Supabase -> SQL Editor)
--
-- Why: your anon key is public (it has to be, it ships in script.js). RLS is
-- the ONLY thing stopping one signed-in user from reading or changing another
-- user's chats, SOP drafts or saved items. Safe to run more than once.
-- ============================================================================

-- ---------- 1. user_data (sync.js: one row per synced key) ----------

create table if not exists public.user_data (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  key        text        not null,
  value      text        not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_data enable row level security;

drop policy if exists "user_data select own" on public.user_data;
drop policy if exists "user_data insert own" on public.user_data;
drop policy if exists "user_data update own" on public.user_data;
drop policy if exists "user_data delete own" on public.user_data;

create policy "user_data select own" on public.user_data
  for select to authenticated using (auth.uid() = user_id);

create policy "user_data insert own" on public.user_data
  for insert to authenticated with check (auth.uid() = user_id);

create policy "user_data update own" on public.user_data
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_data delete own" on public.user_data
  for delete to authenticated using (auth.uid() = user_id);

-- Nobody should be able to use the table as free general storage.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_data_limits') then
    alter table public.user_data
      add constraint user_data_limits
      check (char_length(key) <= 64 and char_length(value) <= 1000000);
  end if;
end $$;

-- OPTIONAL (stricter): only allow the keys sync.js actually uses.
-- Add new keys here whenever you add them to SYNC_KEYS.
-- alter table public.user_data add constraint user_data_keys check (key in (
--   'uniai_settings_v2','uniai-theme','theme','roadmapProgress','studyAbroadChecklist',
--   'uniAIChats','uniAIConversation','uniai-sop-studio','uniai-streak','uniai-daily'));


-- ---------- 2. saved_items (save.js) ----------
-- I have not seen this table's columns. This block turns RLS on and adds the
-- same four policies, but ONLY if the table has a user_id column.

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'saved_items' and column_name = 'user_id') then

    execute 'alter table public.saved_items enable row level security';

    execute 'drop policy if exists "saved_items select own" on public.saved_items';
    execute 'drop policy if exists "saved_items insert own" on public.saved_items';
    execute 'drop policy if exists "saved_items update own" on public.saved_items';
    execute 'drop policy if exists "saved_items delete own" on public.saved_items';

    execute 'create policy "saved_items select own" on public.saved_items for select to authenticated using (auth.uid() = user_id)';
    execute 'create policy "saved_items insert own" on public.saved_items for insert to authenticated with check (auth.uid() = user_id)';
    execute 'create policy "saved_items update own" on public.saved_items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
    execute 'create policy "saved_items delete own" on public.saved_items for delete to authenticated using (auth.uid() = user_id)';
  else
    raise notice 'saved_items has no user_id column (or does not exist): add its policies by hand.';
  end if;
end $$;


-- ---------- 3. AUDIT: run these and read the output ----------

-- Every table in "public" should show rowsecurity = true.
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;

-- Anything with no policy and RLS on is locked to everyone except service_role.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, cmd;

-- Tables that hold public reference data (universities, scholarships) can stay
-- readable by everyone, but should have NO insert/update/delete policy for
-- anon/authenticated roles.