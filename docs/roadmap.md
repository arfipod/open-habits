# Roadmap

Suggested next steps for Open Habits.

## Product

- Improve mobile ergonomics for daily entry editing.
- Add richer filtering and grouping for archived habits.
- Add clearer restore previews before replacing user data.
- Add import summaries that show created habits, entries, skipped rows, and warnings.
- Add optional context search and filtering for personal pattern review.

## Compatibility

- Keep Android-compatible ZIP export readable by Loop Habit Tracker / Android Habits.
- Add fixture coverage for more real-world Loop export variants.
- Preserve scaled numerical values across import, storage, and export.
- Version `OpenHabits.json` intentionally as backup fields evolve.

## Supabase

- Review RLS policies whenever schema changes.
- Add migrations for any new user-owned tables before updating repositories.
- Regenerate `src/lib/supabase/database.types.ts` after schema changes.
- Consider separate non-default integration tests for live Supabase behavior.

## Testing

- Expand coverage around score edge cases, especially `AT_MOST`, `SKIP`, and sparse frequencies.
- Add more UI flow coverage for import, export, context editing, and auth transitions.
- Keep repository tests based on mocked Supabase clients.
- Ensure default CI can run without secrets.

## Operations

- Add GitHub Actions for:

```bash
npm ci
npm run build
npm run test:coverage
```

- Document any deployment environment variables with placeholders only.
- Keep docs aligned with import/export behavior and schema changes.
