create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  position text not null,
  name text not null,
  type text not null check (type in ('YES_NO', 'NUMERICAL')),
  question text not null default '',
  description text not null default '',
  frequency_numerator integer not null check (frequency_numerator > 0),
  frequency_denominator integer not null check (frequency_denominator > 0),
  color text not null default '#8E24AA',
  unit text not null default '',
  target_type text null check (target_type is null or target_type in ('AT_LEAST', 'AT_MOST')),
  target_value numeric null,
  archived boolean not null default false,
  source text not null default 'open_habits',
  external_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habits_id_user_id_key unique (id, user_id)
);

create table if not exists public.habit_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  date date not null,
  value_kind text not null check (value_kind in ('YES_MANUAL', 'YES_AUTO', 'NO', 'SKIP', 'UNKNOWN', 'NUMERIC')),
  numeric_value integer null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habit_entries_numeric_value_matches_kind check (
    (value_kind = 'NUMERIC' and numeric_value is not null)
    or
    (value_kind <> 'NUMERIC' and numeric_value is null)
  ),
  constraint habit_entries_user_habit_date_key unique (user_id, habit_id, date),
  constraint habit_entries_id_user_id_key unique (id, user_id),
  constraint habit_entries_id_habit_id_user_id_key unique (id, habit_id, user_id),
  constraint habit_entries_habit_user_fk foreign key (habit_id, user_id)
    references public.habits(id, user_id) on delete cascade
);

create table if not exists public.habit_entry_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  entry_id uuid not null references public.habit_entries(id) on delete cascade,
  occurred_at timestamptz null,
  occurred_time time null,
  location_text text null,
  comment text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint habit_entry_contexts_entry_id_key unique (entry_id),
  constraint habit_entry_contexts_habit_user_fk foreign key (habit_id, user_id)
    references public.habits(id, user_id) on delete cascade,
  constraint habit_entry_contexts_entry_user_fk foreign key (entry_id, user_id)
    references public.habit_entries(id, user_id) on delete cascade,
  constraint habit_entry_contexts_entry_habit_user_fk foreign key (entry_id, habit_id, user_id)
    references public.habit_entries(id, habit_id, user_id) on delete cascade
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_app text not null default 'loop_habit_tracker',
  file_name text null,
  habits_count integer not null default 0,
  entries_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists habits_user_id_idx on public.habits (user_id);
create index if not exists habits_user_id_archived_idx on public.habits (user_id, archived);
create index if not exists habits_user_id_position_idx on public.habits (user_id, position);

create index if not exists habit_entries_user_habit_date_desc_idx
  on public.habit_entries (user_id, habit_id, date desc);
create index if not exists habit_entries_habit_date_desc_idx
  on public.habit_entries (habit_id, date desc);

create index if not exists habit_entry_contexts_user_id_idx on public.habit_entry_contexts (user_id);
create index if not exists habit_entry_contexts_habit_id_idx on public.habit_entry_contexts (habit_id);
create index if not exists habit_entry_contexts_entry_id_idx on public.habit_entry_contexts (entry_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_habits_updated_at on public.habits;
create trigger set_habits_updated_at
  before update on public.habits
  for each row execute function public.set_updated_at();

drop trigger if exists set_habit_entries_updated_at on public.habit_entries;
create trigger set_habit_entries_updated_at
  before update on public.habit_entries
  for each row execute function public.set_updated_at();

drop trigger if exists set_habit_entry_contexts_updated_at on public.habit_entry_contexts;
create trigger set_habit_entry_contexts_updated_at
  before update on public.habit_entry_contexts
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.habit_entries enable row level security;
alter table public.habit_entry_contexts enable row level security;
alter table public.import_batches enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own
  on public.profiles for delete
  to authenticated
  using (id = auth.uid());

drop policy if exists habits_select_own on public.habits;
create policy habits_select_own
  on public.habits for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists habits_insert_own on public.habits;
create policy habits_insert_own
  on public.habits for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists habits_update_own on public.habits;
create policy habits_update_own
  on public.habits for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists habits_delete_own on public.habits;
create policy habits_delete_own
  on public.habits for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists habit_entries_select_own on public.habit_entries;
create policy habit_entries_select_own
  on public.habit_entries for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists habit_entries_insert_own on public.habit_entries;
create policy habit_entries_insert_own
  on public.habit_entries for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists habit_entries_update_own on public.habit_entries;
create policy habit_entries_update_own
  on public.habit_entries for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists habit_entries_delete_own on public.habit_entries;
create policy habit_entries_delete_own
  on public.habit_entries for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists habit_entry_contexts_select_own on public.habit_entry_contexts;
create policy habit_entry_contexts_select_own
  on public.habit_entry_contexts for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists habit_entry_contexts_insert_own on public.habit_entry_contexts;
create policy habit_entry_contexts_insert_own
  on public.habit_entry_contexts for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists habit_entry_contexts_update_own on public.habit_entry_contexts;
create policy habit_entry_contexts_update_own
  on public.habit_entry_contexts for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists habit_entry_contexts_delete_own on public.habit_entry_contexts;
create policy habit_entry_contexts_delete_own
  on public.habit_entry_contexts for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists import_batches_select_own on public.import_batches;
create policy import_batches_select_own
  on public.import_batches for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists import_batches_insert_own on public.import_batches;
create policy import_batches_insert_own
  on public.import_batches for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists import_batches_update_own on public.import_batches;
create policy import_batches_update_own
  on public.import_batches for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists import_batches_delete_own on public.import_batches;
create policy import_batches_delete_own
  on public.import_batches for delete
  to authenticated
  using (user_id = auth.uid());
