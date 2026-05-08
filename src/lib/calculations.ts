import { EntryValue, Habit, HabitEntry, ScorePoint, Streak } from '../types'
import { addDays, daysBetween, lastNDays, monthKey, todayISO, weekDayIndex } from './date'

export function normalizedNumber(value: EntryValue): number {
  if (typeof value === 'number') return value / 1000
  if (value === 'YES_MANUAL' || value === 'YES_AUTO') return 1
  return 0
}

export function isSuccess(habit: Habit, value: EntryValue | undefined): boolean {
  if (value === undefined || value === 'UNKNOWN') return false
  if (value === 'SKIP') return true

  if (habit.type === 'YES_NO') {
    return value === 'YES_MANUAL' || value === 'YES_AUTO'
  }

  const n = normalizedNumber(value)
  if (habit.targetType === 'AT_MOST') return n <= (habit.targetValue ?? 0)
  return n >= (habit.targetValue ?? 1)
}

export function displayValue(habit: Habit, value: EntryValue | undefined): string {
  if (value === undefined || value === 'UNKNOWN') return ''
  if (habit.type === 'YES_NO') {
    if (value === 'YES_MANUAL' || value === 'YES_AUTO') return '✓'
    if (value === 'SKIP') return '–'
    return '×'
  }
  return String(normalizedNumber(value)).replace('.0', '')
}

export function entryMap(entries: HabitEntry[], habitId: string): Map<string, HabitEntry> {
  return new Map(entries.filter(e => e.habitId === habitId).map(e => [e.date, e]))
}

export function scoreSeries(habit: Habit, entries: HabitEntry[]): ScorePoint[] {
  const map = entryMap(entries, habit.id)
  const dates = [...map.keys()].sort()
  if (dates.length === 0) return []

  const frequency = habit.frequencyNumerator / Math.max(1, habit.frequencyDenominator)
  const multiplier = Math.pow(0.5, Math.sqrt(frequency) / 13)
  let score = 0
  const result: ScorePoint[] = []

  for (const date of daysBetween(dates[0], dates[dates.length - 1])) {
    const value = map.get(date)?.value
    const x = isSuccess(habit, value) ? 1 : 0
    score = score * multiplier + x * (1 - multiplier)
    result.push({ date, score })
  }

  return result
}

export function latestScore(habit: Habit, entries: HabitEntry[]): number {
  const series = scoreSeries(habit, entries)
  return series.length ? series[series.length - 1].score : 0
}

export function periodTotal(habit: Habit, entries: HabitEntry[], period: 'today' | 'week' | 'month' | 'quarter' | 'year'): number {
  const now = todayISO()
  const d = new Date(`${now}T12:00:00`)
  let start = now

  if (period === 'week') start = addDays(now, -6)
  if (period === 'month') start = `${now.slice(0, 7)}-01`
  if (period === 'quarter') {
    const qMonth = Math.floor(d.getMonth() / 3) * 3
    start = `${d.getFullYear()}-${String(qMonth + 1).padStart(2, '0')}-01`
  }
  if (period === 'year') start = `${d.getFullYear()}-01-01`

  return entries
    .filter(e => e.habitId === habit.id && e.date >= start && e.date <= now)
    .reduce((acc, e) => acc + (habit.type === 'NUMERICAL' ? normalizedNumber(e.value) : isSuccess(habit, e.value) ? 1 : 0), 0)
}

export function historyByMonth(habit: Habit, entries: HabitEntry[]): { key: string, value: number }[] {
  const buckets = new Map<string, number>()
  entries.filter(e => e.habitId === habit.id).forEach(e => {
    const key = monthKey(e.date)
    const v = habit.type === 'NUMERICAL' ? normalizedNumber(e.value) : isSuccess(habit, e.value) ? 1 : 0
    buckets.set(key, (buckets.get(key) ?? 0) + v)
  })
  return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ key, value }))
}

export function bestStreaks(habit: Habit, entries: HabitEntry[], limit = 8): Streak[] {
  const map = entryMap(entries, habit.id)
  const dates = [...map.keys()].sort()
  if (!dates.length) return []
  const result: Streak[] = []
  let start: string | null = null
  let end: string | null = null
  let count = 0

  for (const date of daysBetween(dates[0], dates[dates.length - 1])) {
    if (isSuccess(habit, map.get(date)?.value)) {
      start ??= date
      end = date
      count++
    } else if (count > 0 && start && end) {
      result.push({ start, end, days: count })
      start = end = null
      count = 0
    }
  }

  if (count > 0 && start && end) result.push({ start, end, days: count })
  return result.sort((a, b) => b.days - a.days).slice(0, limit)
}

export function weekdayFrequency(habit: Habit, entries: HabitEntry[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0]
  entries.filter(e => e.habitId === habit.id).forEach(e => {
    const v = habit.type === 'NUMERICAL' ? normalizedNumber(e.value) : isSuccess(habit, e.value) ? 1 : 0
    out[weekDayIndex(e.date)] += v
  })
  return out
}

export function upsertEntry(entries: HabitEntry[], habit: Habit, date: string, rawValue: string): HabitEntry[] {
  let value: EntryValue
  if (habit.type === 'YES_NO') {
    value = rawValue === 'yes' ? 'YES_MANUAL' : rawValue === 'skip' ? 'SKIP' : 'NO'
  } else {
    value = Math.round(Number(rawValue || 0) * 1000)
  }

  const existing = entries.find(e => e.habitId === habit.id && e.date === date)
  if (existing) {
    return entries.map(e => e.id === existing.id ? { ...e, value } : e)
  }
  return [...entries, { id: crypto.randomUUID(), habitId: habit.id, date, value }]
}

export function recentDates(): string[] {
  return lastNDays(5).reverse()
}
