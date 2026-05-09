# Architecture

Open Habits is a Vite React application with a TypeScript domain model, pure calculation helpers, ZIP import/export utilities, and Supabase-backed persistence.

## Domain

The core domain types live in `src/types.ts`.

`Habit` represents habit metadata:

- identity and ordering: `id`, `position`
- display fields: `name`, `question`, `description`, `color`, `unit`
- behavior: `type`, `frequencyNumerator`, `frequencyDenominator`, `targetType`, `targetValue`
- lifecycle fields: `archived`, `createdAt`, `updatedAt`

`HabitEntry` represents one dated value for one habit. YES/NO habits use string values such as `YES_MANUAL`, `NO`, `SKIP`, and `UNKNOWN`. Numerical habits use integer values scaled by 1000 to preserve Loop Habit Tracker compatibility.

`HabitEntryContext` is Open Habits-only metadata for an entry. It can store `occurredAt`, `occurredTime`, `locationText`, and `comment`.

`AppData` is the in-memory aggregate:

```ts
interface AppData {
  habits: Habit[]
  entries: HabitEntry[]
  entryContexts: HabitEntryContext[]
}
```

## Data Flow

At runtime, `App.tsx` owns the main UI composition and delegates persistence to `useSupabaseAppData`.

The high-level flow is:

1. `AuthGate` obtains a Supabase session.
2. `useSupabaseAppData` loads data from repository functions under `src/lib/supabase/repositories.ts`.
3. UI components render habit lists, details, charts, forms, imports, exports, entries, and optional context.
4. Mutations go through repository functions and then update local React state.
5. Import and export operations use `src/lib/csv.ts`.
6. Derived views use pure helpers from `src/lib/calculations.ts` and `src/lib/date.ts`.

Supabase access should remain isolated in the repository and mapper modules. Visual components should receive domain data and callbacks rather than issuing database queries directly.

## Supabase

Supabase provides:

- Auth for user accounts and sessions.
- Postgres tables for habits, entries, entry contexts, profiles, and import batches.
- Row Level Security so users can access only their own rows.

Frontend Supabase initialization lives in:

```text
src/lib/supabase/client.ts
src/lib/supabase/env.ts
```

Data mapping lives in:

```text
src/lib/supabase/mappers.ts
```

Repository operations live in:

```text
src/lib/supabase/repositories.ts
```

Migrations live in:

```text
supabase/migrations/
```

## Derived Calculations vs Persisted Data

Persist primary user data only:

- habits
- habit entries
- optional entry contexts
- lightweight import batch metadata
- profiles

Derived outputs should be computed from habits and entries:

- score series
- target totals
- history summaries
- calendar grid state
- best streaks
- frequency summaries

This keeps exports portable, avoids stale derived data, and makes score or chart fixes possible without destructive migrations.

## Local Storage

`localStorage` is only for harmless UI preferences such as the selected habit id. It must not store the full app database, Supabase credentials, or private user data that belongs in Postgres.
