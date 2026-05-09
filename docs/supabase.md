# Supabase

Open Habits uses Supabase Auth and Supabase Postgres as the shared source of truth. The frontend must only use the project URL and publishable key.

Public project URL:

```text
https://tpehkqzwlbtdonizlody.supabase.co
```

## Environment

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Set:

```env
VITE_SUPABASE_URL=https://tpehkqzwlbtdonizlody.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
```

Do not place database connection URLs, Postgres passwords, service role keys, personal access tokens, or a Supabase Direct Connection String in frontend code, tests, docs, committed files, or generated artifacts.

## CLI Setup

Use the Supabase CLI:

```bash
supabase login
supabase init
supabase link --project-ref tpehkqzwlbtdonizlody
supabase db push
```

The database migration files live in:

```text
supabase/migrations/
```

## Schema

The current migration creates these application tables:

- `profiles`
- `habits`
- `habit_entries`
- `habit_entry_contexts`
- `import_batches`

`profiles` stores one profile row per Supabase Auth user. A database trigger creates or updates the profile when a user is inserted into `auth.users`.

`habits` stores habit metadata: position, name, type, question, description, frequency, color, unit, target type, target value, archived state, source, external id, and timestamps.

`habit_entries` stores one value per user, habit, and date. Boolean-style values are stored in `value_kind`. Numerical values use `value_kind = 'NUMERIC'` plus `numeric_value`, where values imported from Loop Habit Tracker are scaled by 1000.

`habit_entry_contexts` stores Open Habits-only context for entries: `occurred_at`, `occurred_time`, `location_text`, and `comment`.

`import_batches` stores lightweight audit metadata for imports: source app, file name, counts, metadata, and creation time.

The schema also includes uniqueness constraints, ownership-preserving foreign keys, indexes, and `updated_at` triggers.

## Row Level Security

RLS is enabled on every application table.

`profiles` policies restrict rows to:

```sql
id = auth.uid()
```

All other user-owned tables restrict select, insert, update, and delete to:

```sql
user_id = auth.uid()
```

Do not disable RLS for convenience. Do not use a service role key from frontend code.

## Migrations

Add schema changes as new SQL files under:

```text
supabase/migrations/
```

After adding or changing migrations:

```bash
supabase db push
```

When a migration changes the public schema, regenerate TypeScript types:

```bash
npx supabase gen types typescript --project-id tpehkqzwlbtdonizlody > src/lib/supabase/database.types.ts
```

## Data Access

Use repository functions from `src/lib/supabase/repositories.ts` rather than querying Supabase directly in components.

Use mapper functions from `src/lib/supabase/mappers.ts` to translate between database rows and domain types.

Tests should mock the Supabase client and should not require real Supabase credentials.
