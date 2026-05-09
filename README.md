# Open Habits Loop v0.3

Responsive React + Vite + TypeScript frontend that replicates the core logic of Loop Habit Tracker / Android Habits.

## Run

```bash
unzip open-habits-loop-v03.zip
cd open-habits-loop-v03
npm install
cp .env.example .env.local
npm run dev
```

Open the URL shown by Vite, usually:

```text
http://localhost:5173
```

## Import a Loop Habit Tracker ZIP

1. Sign in or create an account.
2. Click **Import ZIP**.
3. Select the ZIP exported from Android Habits / Loop Habit Tracker.
4. Keep **Replace on import** enabled to clear previous Supabase data for your user.

The app reads:

```text
Habits.csv
Checkmarks.csv
Scores.csv
001 Habit name/Checkmarks.csv
001 Habit name/Scores.csv
```

`Scores.csv` files are exported, but when importing they are recalculated from `Checkmarks.csv`, because daily entries are the real source of truth.

## Important v0.3 Fix

The score formula now replicates Loop's core logic:

```text
multiplier = 0.5 ^ (sqrt(frequency) / 13)
score = previousScore * multiplier + checkmarkValue * (1 - multiplier)
```

Also:

- For numerical `AT_MOST` habits, the initial score is `1.0`.
- For numerical habits, a rolling sum is calculated across `FrequencyDenominator` days.
- For non-daily boolean habits, smoothing is applied by doubling the numerator and denominator, as Loop does.
- `SKIP` does not update the score.

With the `No PMO` sample ZIP, the expected latest score is `0.8453` for `2026-05-08`.

## Included Features

- Import ZIP files.
- Export ZIP files for one or more habits.
- Create, edit, archive, and delete habits.
- `YES_NO` and `NUMERICAL` habits.
- `AT_LEAST` and `AT_MOST` targets.
- Target: today, week, month, quarter, year.
- Score with left/right navigation.
- History by week/month/quarter/year with navigation.
- Calendar in a Monday-Sunday weekly grid with horizontal navigation.
- Best streaks.
- Frequency.
- Supabase Auth and per-user Supabase persistence.
- `localStorage` is used only for harmless UI preferences such as the last selected habit.
