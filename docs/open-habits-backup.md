# Open Habits Full Backup

Open Habits full backups are ZIP files for this app's own restore flow. They are separate from Android-compatible Loop Habit Tracker exports.

The ZIP contains:

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

The `contexts` array may include `occurredAt`, `occurredTime`, `locationText`, and `comment`. These fields are Open Habits-only metadata and must not be included in Android-compatible ZIP exports.

Android-compatible exports continue to use only the Loop Habit Tracker CSV files and omit `OpenHabits.json`.
