# Open Habits

Open Habits is a React + Vite + TypeScript web app that replicates the core behavior of Loop Habit Tracker / Android Habits while adding Supabase persistence and Open Habits-only entry context.

It is designed for people who want Android Habits-compatible habit data, portable ZIP imports and exports, and a web interface backed by Supabase Auth and Postgres.

## Features

- YES/NO habits.
- NUMERICAL habits.
- `AT_LEAST` and `AT_MOST` targets.
- Flexible frequencies such as `1/1`, `3/7`, and `1/7`.
- Loop-compatible score calculation.
- Target, history, calendar, best streaks, and frequency views.
- Android Habits / Loop Habit Tracker ZIP import.
- Android-compatible ZIP export.
- Open Habits full backup export.
- Optional context per entry: time, place, and comment.
- Supabase Auth and Supabase Postgres persistence.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the URL printed by Vite, usually:

```text
http://localhost:5173
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the frontend Supabase values:

```env
VITE_SUPABASE_URL=https://tpehkqzwlbtdonizlody.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
```

Only these variables should be used by the frontend:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Do not put database passwords, service role keys, personal access tokens, or a Supabase Direct Connection String in frontend code, docs, tests, committed files, or generated artifacts.

## Supabase CLI

Use the Supabase CLI to link and apply migrations:

```bash
supabase login
supabase init
supabase link --project-ref tpehkqzwlbtdonizlody
supabase db push
```

Regenerate database types when the schema changes:

```bash
npx supabase gen types typescript --project-id tpehkqzwlbtdonizlody > src/lib/supabase/database.types.ts
```

Database migrations live in:

```text
supabase/migrations/
```

## Tests

Run the test suite:

```bash
npm run test
npm run test:coverage
```

Tests cover calculation behavior, ZIP import/export, Supabase mappers and repositories, UI flows, and optional entry context.

## Build

```bash
npm run build
```

The build runs TypeScript first and then creates the Vite production bundle.

## Import and Export

Open Habits supports two ZIP families:

- Android-compatible Loop Habit Tracker ZIPs, containing only data Loop understands.
- Open Habits full backups, containing `OpenHabits.json` plus all Open Habits data, including optional entry context.

Android-compatible exports must not include Open Habits-only context fields such as `locationText`, `occurredAt`, `occurredTime`, or context comments.

See [docs/import-export.md](docs/import-export.md) for the details.

## Secret Security

Never commit real secrets.

Do not commit:

- `.env`
- `.env.local`
- Supabase Direct Connection String
- Postgres passwords
- service role keys
- personal access tokens

The public Supabase project URL is safe to document:

```text
https://tpehkqzwlbtdonizlody.supabase.co
```

The publishable key belongs in `.env.local` with a placeholder in docs, not with a real value.

See [docs/security.md](docs/security.md) for the full security checklist.

## Project Structure

```text
src/
  components/
  hooks/
  lib/
    calculations.ts
    csv.ts
    date.ts
    storage.ts
    supabase/
      client.ts
      env.ts
      database.types.ts
      mappers.ts
      repositories.ts
  test/
docs/
supabase/
  migrations/
```

Key docs:

- [docs/architecture.md](docs/architecture.md)
- [docs/supabase.md](docs/supabase.md)
- [docs/import-export.md](docs/import-export.md)
- [docs/testing.md](docs/testing.md)
- [docs/security.md](docs/security.md)
- [docs/roadmap.md](docs/roadmap.md)
