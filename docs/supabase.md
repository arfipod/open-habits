# Supabase

Open Habits uses Supabase Auth and Supabase Postgres for the shared source of truth. The frontend must only use the project URL and publishable key.

Never put database connection URLs, Postgres passwords, service role keys, or personal access tokens in frontend code, tests, docs, or committed files.

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

## Project Setup

Install and authenticate the Supabase CLI, then link this repository to the project:

```bash
supabase login
supabase init
supabase link --project-ref tpehkqzwlbtdonizlody
```

The database migration files live in:

```text
supabase/migrations/
```

## Apply Migrations

Push the local migrations to the linked Supabase project:

```bash
supabase db push
```

The initial migration creates the `public` tables, constraints, indexes, update triggers, profile bootstrap trigger, and row-level security policies.

## Regenerate Types

After schema changes, regenerate the TypeScript database types:

```bash
npx supabase gen types typescript --project-id tpehkqzwlbtdonizlody > src/lib/supabase/database.types.ts
```

## Tables

`profiles` stores one profile row per Supabase Auth user. It is created automatically by the `auth.users` insert trigger.

`habits` stores habit metadata: type, target, frequency, color, archived state, and optional import source identifiers.

`habit_entries` stores one value per user, habit, and date. Boolean-style values are stored in `value_kind`; numerical habit values use `value_kind = 'NUMERIC'` and `numeric_value`, with Loop-compatible values scaled by 1000.

`habit_entry_contexts` stores Open Habits-only optional context for entries: occurred timestamp, occurred time, location text, and comment.

`import_batches` stores lightweight audit metadata for ZIP imports.

## Row-Level Security

RLS is enabled on every application table.

`profiles` policies restrict access to rows where `id = auth.uid()`.

All other tables restrict select, insert, update, and delete to rows where `user_id = auth.uid()`.

Foreign-key constraints also keep entry and context rows tied to habits and entries owned by the same `user_id`.

## Android-Compatible Exports

`habit_entry_contexts` must not be included in Android-compatible Loop Habit Tracker ZIP exports.

Loop Habit Tracker understands `Habits.csv`, `Checkmarks.csv`, `Scores.csv`, and per-habit checkmark/score CSV files. It does not understand Open Habits-only fields such as `location_text`, `occurred_at`, `occurred_time`, or context comments. Including those fields would make the export non-compatible and could leak private metadata into a file intended for Android import.

Open Habits full backups may include context metadata because they target this app's own restore flow rather than Loop Habit Tracker compatibility.
