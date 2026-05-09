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

## CLI Access And Migration Setup

Use the Supabase CLI to authenticate this machine, link the local repository to the hosted project, and apply the committed migrations.

The commands below use `npx supabase` so the workflow does not require a global Supabase CLI install:

```bash
npx supabase login
npx supabase link --project-ref tpehkqzwlbtdonizlody
npx supabase db push
```

During `npx supabase login`, the CLI opens a browser login flow and may print a one-time login URL plus a verification code prompt. Do not commit or document those one-time URLs, verification codes, generated access tokens, or personal access tokens.

During `npx supabase db push`, confirm the prompt to apply pending migrations to the remote database. For a fresh project, the expected pending migration is:

```text
20260509103411_initial_schema.sql
```

The database migration files live in:

```text
supabase/migrations/
```

After the migration has been applied, start the app:

```bash
npm run dev
```

Open the local URL printed by Vite. If the default port is already occupied, Vite will choose the next available port, for example `http://localhost:5175/`.

If the app logs in successfully but the main screen shows an error such as `Could not find the table 'public.habits' in the schema cache`, the Auth setup is working but the database schema has not been applied to the linked project yet. Run `npx supabase db push`, wait a few seconds for the Supabase REST schema cache to refresh, and reload the app.

## Auth URL Configuration

Magic links use the current browser origin as their redirect target. A link requested from local Vite should return to `http://localhost:5173`. A link requested from the Vercel deployment should return to that Vercel domain.

Supabase only honors redirect targets that are allowed in **Authentication > URL Configuration**. Configure:

- **Site URL**: the production app URL, for example `https://open-habits.vercel.app`.
- **Redirect URLs**: every origin that can request magic links, including `http://localhost:5173/**`, the production Vercel URL, and any Vercel preview URL pattern used for testing.

If a magic-link email opens `http://localhost:3000`, the Supabase project likely still has `localhost:3000` as its Site URL or the requested app URL is missing from the Redirect URLs allow-list. Update those dashboard settings, request a new magic link, and use the new email. Old magic-link emails keep their original URL.

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
npx supabase db push
```

When a migration changes the public schema, regenerate TypeScript types:

```bash
npx supabase gen types typescript --project-id tpehkqzwlbtdonizlody > src/lib/supabase/database.types.ts
```

## Data Access

Use repository functions from `src/lib/supabase/repositories.ts` rather than querying Supabase directly in components.

Use mapper functions from `src/lib/supabase/mappers.ts` to translate between database rows and domain types.

Tests should mock the Supabase client and should not require real Supabase credentials.
