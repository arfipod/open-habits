# AGENTS.md

## Project

Open Habits is a React + Vite + TypeScript web application that replicates the core behavior of Loop Habit Tracker / Android Habits.

The app supports:

- YES/NO habits.
- NUMERICAL habits.
- AT_LEAST and AT_MOST targets.
- Flexible frequencies such as 1/1, 3/7 and 1/7.
- Score, target, history, calendar, best streaks and frequency charts.
- Import from Loop Habit Tracker / Android Habits ZIP exports.
- Export to Android-compatible ZIP.
- Export to Open Habits full backup.
- Optional entry context: time, place and comment.
- Supabase Auth and Supabase Postgres persistence.

## Tech Stack

- React
- Vite
- TypeScript
- Supabase JS
- Supabase Postgres
- Vitest
- Testing Library
- JSZip

## Important Security Rules

Never commit secrets.

Do not commit:

- `.env`
- `.env.local`
- Supabase Direct Connection String
- Postgres passwords
- Service role keys
- Personal access tokens

The frontend may use only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The Supabase Direct Connection String is only for local CLI or private deployment tooling. It must never appear in frontend code, tests, docs or committed files.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with:

```env
VITE_SUPABASE_URL=https://tpehkqzwlbtdonizlody.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key_here
```

## Supabase Setup

```bash
supabase login
supabase init
supabase link --project-ref tpehkqzwlbtdonizlody
supabase db push
```

Regenerate database types when schema changes:

```bash
npx supabase gen types typescript --project-id tpehkqzwlbtdonizlody > src/lib/supabase/database.types.ts
```

## Common Commands

```bash
npm run dev
npm run build
npm run test
npm run test:coverage
```

## Code Organization

Expected structure:

```text
src/
  components/
  hooks/
  lib/
    calculations.ts
    csv.ts
    date.ts
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

## Domain Rules

### Habit

A habit has:

- id
- position
- name
- type
- question
- description
- frequency numerator
- frequency denominator
- color
- unit
- target type
- target value
- archived flag
- timestamps

### Entry

A habit entry has:

- id
- habit id
- date
- value
- notes
- timestamps

Entry values are:

- `YES_MANUAL`
- `YES_AUTO`
- `NO`
- `SKIP`
- `UNKNOWN`
- numeric values scaled by 1000

### Entry Context

Entry context is optional Open Habits-only metadata:

- occurred at
- occurred time
- location text
- comment

This metadata must not be included in Android-compatible Loop Habit Tracker exports.

## Import/Export Rules

### Android-compatible ZIP

The Android-compatible export must include only data that Loop Habit Tracker understands.

It may include:

- `Habits.csv`
- `Checkmarks.csv`
- `Scores.csv`
- per-habit `Checkmarks.csv`
- per-habit `Scores.csv`

It must not include:

- `locationText`
- `occurredAt`
- `occurredTime`
- Open Habits context comments
- Supabase user ids
- internal audit metadata

### Open Habits Full Backup

The Open Habits full backup may include all Open Habits data, including context metadata.

It should include:

- backup version
- export timestamp
- habits
- entries
- entry contexts

## Testing Requirements

Before finishing any change, run:

```bash
npm run build
npm run test
```

For larger changes, run:

```bash
npm run test:coverage
```

Tests should cover:

- calculations
- score behavior
- import/export
- Supabase mappers
- Supabase repositories with mocked client
- UI flows
- optional entry context
- Android export excluding Open Habits-only context

## Development Guidelines

- Keep calculation logic pure when possible.
- Keep Supabase access isolated in repository modules.
- Do not put Supabase queries directly inside visual components unless there is a strong reason.
- Prefer domain mappers between database rows and UI types.
- Keep Android-compatible import/export separate from Open Habits full backup import/export.
- Do not break existing ZIP compatibility.
- Do not store the full app database in localStorage.
- localStorage may be used only for harmless UI preferences.

## Pull Request Checklist

- [ ] No secrets committed.
- [ ] Build passes.
- [ ] Tests pass.
- [ ] Supabase migrations added when schema changes.
- [ ] Database types regenerated when schema changes.
- [ ] Docs updated when behavior changes.
- [ ] Android-compatible export still excludes Open Habits-only context.
- [ ] Open Habits full backup includes all Open Habits data.
