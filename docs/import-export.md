# Import and Export

Open Habits supports two ZIP families:

1. Android-compatible Loop Habit Tracker / Android Habits ZIP files.
2. Open Habits full backup ZIP files.

Keep these formats separate. Android-compatible exports are for interoperability. Open Habits backups are for preserving all Open Habits data.

## Loop Format

Loop Habit Tracker ZIPs are CSV-based. Open Habits reads:

```text
Habits.csv
Checkmarks.csv
001 Habit name/Checkmarks.csv
```

Open Habits writes:

```text
Habits.csv
Checkmarks.csv
Scores.csv
001 Habit name/Checkmarks.csv
001 Habit name/Scores.csv
```

During import:

- `Habits.csv` is required.
- Per-habit `Checkmarks.csv` files are preferred when available.
- Aggregate `Checkmarks.csv` is used as a fallback for habits without per-habit checkmark files.
- `Scores.csv` is not treated as source of truth; scores are recalculated from entries.
- Imported Android data does not create entry contexts.

Numerical values are preserved in Loop's scaled integer format:

```text
1000 = 1
2500 = 2.5
```

## Android-Compatible ZIP Export

The Android-compatible export must include only data that Loop Habit Tracker understands.

It may include:

- `Habits.csv`
- `Checkmarks.csv`
- `Scores.csv`
- per-habit `Checkmarks.csv`
- per-habit `Scores.csv`

It must not include:

- `OpenHabits.json`
- `locationText`
- `occurredAt`
- `occurredTime`
- Open Habits context comments
- Supabase user ids
- internal audit metadata
- import batch metadata
- private application state

This exclusion is both a compatibility requirement and a privacy requirement. Context fields can reveal sensitive patterns and must not leak into files intended for Android Habits import.

## Open Habits Full Backup Format

Open Habits full backups are ZIP files for this app's own restore flow.

The ZIP currently contains:

```text
OpenHabits.json
Habits.csv
Checkmarks.csv
Scores.csv
```

`OpenHabits.json` is the source of truth for Open Habits-specific data:

```ts
interface OpenHabitsBackup {
  backupVersion: 1
  exportedAt: string
  habits: Habit[]
  entries: HabitEntry[]
  contexts: HabitEntryContext[]
}
```

The `contexts` array may include:

- `occurredAt`
- `occurredTime`
- `locationText`
- `comment`

Open Habits backups do not need to be compatible with Android Habits.

## Restore Behavior

When importing a ZIP, `parseImportZip` checks whether `OpenHabits.json` exists.

- If it exists, Open Habits parses the full backup and preserves contexts.
- If it does not exist, Open Habits parses the ZIP as a Loop Habit Tracker export and returns no contexts.

When adding future backup fields, keep `backupVersion` meaningful and preserve backward compatibility where practical.
