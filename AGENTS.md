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

The Supabase Direct Connection String is only for local CLI usage, private migration tooling, or secure deployment workflows. It must never appear in frontend code, tests, documentation, committed files, or generated artifacts.

If a secret has ever been pasted into the repository, remove it immediately and rotate it in the provider dashboard.

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

Do not place private database credentials in `.env.local` for the frontend.

## Supabase Setup

Use the Supabase CLI:

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

Database migrations should live in:

```text
supabase/migrations/
```

## Common Commands

```bash
npm run dev
npm run build
npm run test
npm run test:coverage
```

If a command does not exist yet, add it as part of the relevant implementation task.

## Expected Code Organization

Expected structure:

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

Keep Supabase-specific code isolated under:

```text
src/lib/supabase/
```

Do not place Supabase queries directly inside visual components unless there is a strong reason.

## Domain Model

### Habit

A habit has:

- `id`
- `position`
- `name`
- `type`
- `question`
- `description`
- `frequencyNumerator`
- `frequencyDenominator`
- `color`
- `unit`
- `targetType`
- `targetValue`
- `archived`
- `createdAt`
- `updatedAt`

Habit types:

```ts
type HabitType = 'YES_NO' | 'NUMERICAL'
```

Target types:

```ts
type TargetType = 'AT_LEAST' | 'AT_MOST' | ''
```

### Habit Entry

A habit entry has:

- `id`
- `habitId`
- `date`
- `value`
- `notes`
- `createdAt`
- `updatedAt`

Entry values are:

- `YES_MANUAL`
- `YES_AUTO`
- `NO`
- `SKIP`
- `UNKNOWN`
- numeric values scaled by 1000

Example:

```text
1000 = 1
2000 = 2
3000 = 3
```

For numerical habits imported from Loop Habit Tracker, preserve the scaled integer format internally unless a mapper explicitly converts it.

### Entry Context

Entry context is optional Open Habits-only metadata.

It may include:

- `occurredAt`
- `occurredTime`
- `locationText`
- `comment`

This metadata is useful for understanding behavior patterns, such as:

- where a vice occurred;
- when a habit was performed;
- what triggered a failure;
- what helped a positive habit succeed.

Entry context must not be included in Android-compatible Loop Habit Tracker exports.

## Database Rules

Supabase should be the source of truth once database integration is implemented.

Expected tables:

- `profiles`
- `habits`
- `habit_entries`
- `habit_entry_contexts`
- `import_batches`

Use Row Level Security.

Every user-owned table must ensure that users can only access their own rows.

Use `auth.uid()` in RLS policies.

Expected RLS rule pattern:

```sql
user_id = auth.uid()
```

For profiles:

```sql
id = auth.uid()
```

Do not disable RLS for convenience.

Do not use a service role key from frontend code.

## Persistence Rules

Before Supabase integration, local persistence may use `localStorage`.

After Supabase integration:

- Supabase is the source of truth.
- `localStorage` may only store harmless UI preferences.
- Do not store the full application database in `localStorage`.
- Do not store Supabase secrets in `localStorage`.

Allowed local preferences include:

- selected habit id;
- last selected period;
- UI display options;
- theme preference.

## Calculation Rules

Keep calculation logic pure whenever possible.

Important derived features:

- target totals;
- score;
- history;
- calendar grid;
- best streaks;
- frequency.

These should be computed from habits and entries, not stored as primary data.

### Score

The score should follow Loop Habit Tracker's behavior as closely as possible.

Core formula:

```text
multiplier = 0.5 ^ (sqrt(frequency) / 13)

score =
  previousScore * multiplier
  + checkmarkValue * (1 - multiplier)
```

Important details:

- Numerical `AT_MOST` habits may start from a high/complete score depending on imported data behavior.
- `SKIP` should not penalize the score.
- `UNKNOWN` should not count as success.
- Numerical values are evaluated according to `targetType`.
- YES/NO values are evaluated according to Loop semantics.
- Keep test coverage around score behavior, especially for `No PMO`-style habits.

## Import/Export Rules

Open Habits supports two export families:

1. Android-compatible Loop Habit Tracker ZIP.
2. Open Habits full backup.

Keep these formats separate.

### Android-Compatible ZIP

The Android-compatible export must include only data that Loop Habit Tracker understands.

It may include:

```text
Habits.csv
Checkmarks.csv
Scores.csv
001 Habit name/Checkmarks.csv
001 Habit name/Scores.csv
```

It must not include:

- `locationText`
- `occurredAt`
- `occurredTime`
- Open Habits context comments
- Supabase user ids
- internal audit metadata
- import batch metadata
- private application state

Android-compatible export should remain readable by Loop Habit Tracker / Android Habits.

### Open Habits Full Backup

The Open Habits full backup may include all Open Habits data, including context metadata.

It should include:

- backup version;
- export timestamp;
- habits;
- entries;
- entry contexts;
- optional import metadata.

Recommended file:

```text
OpenHabits.json
```

This backup does not need to be compatible with Android Habits.

## Import Rules

When importing a Loop Habit Tracker ZIP:

- Read `Habits.csv`.
- Read per-habit `Checkmarks.csv` files when available.
- Use aggregate `Checkmarks.csv` as fallback.
- Recalculate scores from entries.
- Do not import `Scores.csv` as source of truth.
- Do not invent context metadata.
- Imported Android data should have no `habit_entry_contexts` unless the user later adds them manually.

When importing an Open Habits full backup:

- Preserve habits.
- Preserve entries.
- Preserve contexts.
- Avoid leaking original Supabase user ids across users.
- Remap ids safely when necessary.

## Supabase Data Access Guidelines

Use repository functions instead of direct component queries.

Current repository functions include:

```ts
fetchAppData(userId): Promise<AppData>
loadAppData(): Promise<AppData>
createHabit(habit): Promise<Habit>
upsertHabit(habit): Promise<Habit>
updateHabit(habit): Promise<Habit>
deleteHabit(habitId): Promise<void>
upsertEntry(entry): Promise<HabitEntry>
deleteEntry(entryId): Promise<void>
fetchEntryContexts(userId): Promise<HabitEntryContext[]>
upsertEntryContext(context): Promise<HabitEntryContext>
deleteEntryContext(entryId): Promise<void>
replaceAllUserDataFromImport(data, fileName): Promise<AppData>
appendUserDataFromImport(data, fileName): Promise<AppData>
exportableDataForUser(): Promise<AppData>
```

Use mappers between database rows and domain types.

Current mapper functions include:

```ts
habitRowToHabit
habitToInsert
habitToUpdate
entryRowToHabitEntry
entryToInsert
entryToUpdate
entryValueToDb
entryValueFromDb
contextRowToHabitEntryContext
contextToInsert
```

## UI Guidelines

The app should remain responsive and mobile-friendly.

Important screens and components:

- Auth gate.
- Habit list.
- Habit detail.
- Habit form.
- Import/export modal.
- Entry editor.
- Optional context editor.
- User menu.

The UI should preserve the spirit of Loop Habit Tracker:

- clear habit rows;
- color-coded states;
- calendar-style habit history;
- score/history navigation;
- simple daily registration;
- low-friction entry editing.

Avoid turning the UI into a generic CRUD dashboard.

## Testing Requirements

Before finishing any significant change, run:

```bash
npm run build
npm run test
```

For larger changes, run:

```bash
npm run test:coverage
```

Tests should cover:

- calculations;
- score behavior;
- target totals;
- history grouping;
- calendar grid behavior;
- streak computation;
- frequency computation;
- ZIP import;
- Android-compatible ZIP export;
- Open Habits full backup export;
- Supabase mappers;
- Supabase repositories with mocked client;
- UI flows;
- optional entry context;
- Android-compatible export excluding Open Habits-only context.

Do not require real Supabase credentials in tests.

Do not use production data in tests.

Use fixtures.

## CI Requirements

The repository should have GitHub Actions running:

```bash
npm ci
npm run build
npm run test:coverage
```

CI must not require secrets unless explicitly documented.

If Supabase integration tests are later added, keep them separate from the default CI path.

## Documentation Requirements

Keep documentation up to date when behavior changes.

Expected docs:

```text
README.md
docs/architecture.md
docs/supabase.md
docs/import-export.md
docs/testing.md
docs/security.md
docs/roadmap.md
AGENTS.md
```

Documentation must not contain real secrets.

Documentation may contain public project references such as:

```text
https://tpehkqzwlbtdonizlody.supabase.co
```

Documentation must not contain:

- Direct Connection String;
- database password;
- service role key;
- personal access tokens.

## Development Guidelines

- Keep calculation logic pure.
- Keep IO and side effects isolated.
- Keep Supabase access in repository modules.
- Keep Android-compatible import/export separate from Open Habits full backup import/export.
- Do not break existing ZIP compatibility.
- Do not store full app data in `localStorage` once Supabase is active.
- Prefer explicit types over `any`.
- Prefer small, testable functions.
- Prefer deterministic date handling in tests.
- Avoid hidden global state.
- Avoid silently swallowing errors.
- Surface useful error messages to the UI.
- Keep code readable and maintainable.

## Pull Request Checklist

Before opening or finalizing a PR:

- [ ] No secrets committed.
- [ ] Build passes.
- [ ] Tests pass.
- [ ] Coverage is acceptable for changed areas.
- [ ] Supabase migrations added when schema changes.
- [ ] Database types regenerated when schema changes.
- [ ] Docs updated when behavior changes.
- [ ] Android-compatible export still excludes Open Habits-only context.
- [ ] Open Habits full backup includes Open Habits-only context.
- [ ] UI still works on mobile widths.
- [ ] Import/export flows were manually checked when touched.
- [ ] RLS assumptions were reviewed for database changes.

## Commit Style

Use clear, focused commits.

Examples:

```text
feat: add supabase schema and rls policies
feat: replace local storage with supabase persistence
feat: add optional context for habit entries
test: cover score and import export flows
docs: add supabase setup and security notes
```

Avoid mixing unrelated changes in one commit.

## Safety Notes for Future Agents

This project deals with personal habit data. Treat it as private user data.

Do not log sensitive habit entries unnecessarily.

Do not expose user data across accounts.

Do not weaken RLS.

Do not add analytics or telemetry without explicit user approval.

Do not introduce third-party tracking scripts.

Do not upload habit data to external services unless the user explicitly asks for that integration.
