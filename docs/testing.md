# Testing

Open Habits uses Vitest, Testing Library, jsdom, and fixture-based tests.

## Commands

Run the default test suite:

```bash
npm run test
```

Run coverage:

```bash
npm run test:coverage
```

Run a production build:

```bash
npm run build
```

Before finishing significant changes, run:

```bash
npm run build
npm run test
```

For larger changes, run coverage too:

```bash
npm run test:coverage
```

## Coverage Strategy

Prioritize coverage for behavior that protects user data and import/export compatibility:

- score calculations
- target totals
- history grouping
- calendar grids
- streaks
- frequency summaries
- Loop ZIP import
- Android-compatible ZIP export
- Open Habits full backup export and import
- optional entry context
- Supabase mappers
- Supabase repositories
- UI flows for entry editing, import, export, and auth state

Use deterministic dates in tests. Avoid tests that depend on the real current day unless the date is explicitly controlled.

## Fixtures

Shared test fixtures live under:

```text
src/test/fixtures/
```

Use fixtures for habits, entries, contexts, and ZIP files. Do not use production data in tests.

## Mocking Supabase

Supabase repository tests should mock the client instead of using real credentials or a live project.

Useful patterns:

- pass a mocked client through repository options
- pass an explicit `userId` through repository options
- assert table names, filters, inserts, upserts, and deletes
- return database-shaped rows and verify domain-shaped outputs

Tests must not require:

- `.env.local`
- a real Supabase session
- a service role key
- production data

## Import/Export Assertions

Android-compatible export tests should assert that context fields are absent from exported ZIP contents.

Open Habits backup tests should assert that `OpenHabits.json` includes contexts and can be parsed back into `AppData`.
