import { AppData, EntryValue, Habit, HabitEntry, HistoryPoint, PeriodKind, ScorePoint, Streak } from '../types'
import {
  addDays,
  addMonths,
  clampISO,
  daysBetween,
  daysUntil,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  formatShort,
  maxISO,
  minISO,
  monthLabel,
  parseISODate,
  startOfMonth,
  startOfQuarter,
  startOfWeekMonday,
  startOfYear,
  todayISO,
  toISODate,
  weekDayIndexMonday
} from './date'

export const ENTRY = {
  UNKNOWN: -1,
  NO: 0,
  YES_AUTO: 1,
  YES_MANUAL: 2,
  SKIP: 3
} as const

export function createId(): string {
  const random = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined
  if (random?.randomUUID) {
    return random.randomUUID()
  }

  const bytes = new Uint8Array(16)
  if (random?.getRandomValues) {
    random.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0'))
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join('')
  ].join('-')
}

export function nowISO(): string {
  return new Date().toISOString()
}

export function referenceDateForHabit(habit: Habit, entries: HabitEntry[]): string {
  const dates = entries.filter(e => e.habitId === habit.id).map(e => e.date)
  return maxISO(dates) ?? todayISO()
}

export function referenceDateForData(data: AppData): string {
  return maxISO(data.entries.map(e => e.date)) ?? todayISO()
}

export function entryToInt(value: EntryValue | undefined): number {
  if (value === undefined) return ENTRY.UNKNOWN
  if (typeof value === 'number') return value
  switch (value) {
    case 'YES_MANUAL': return ENTRY.YES_MANUAL
    case 'YES_AUTO': return ENTRY.YES_AUTO
    case 'NO': return ENTRY.NO
    case 'SKIP': return ENTRY.SKIP
    case 'UNKNOWN': return ENTRY.UNKNOWN
  }
}

export function intToEntryValue(value: number): EntryValue {
  switch (value) {
    case ENTRY.YES_MANUAL: return 'YES_MANUAL'
    case ENTRY.YES_AUTO: return 'YES_AUTO'
    case ENTRY.NO: return 'NO'
    case ENTRY.SKIP: return 'SKIP'
    case ENTRY.UNKNOWN: return 'UNKNOWN'
    default: return value
  }
}

export function numericAmount(value: EntryValue | undefined): number {
  const n = entryToInt(value)
  if (n <= 0 || n === ENTRY.SKIP) return 0
  return n / 1000
}

export function getHabitEntries(entries: HabitEntry[], habitId: string): HabitEntry[] {
  return entries.filter(e => e.habitId === habitId).sort((a, b) => a.date.localeCompare(b.date))
}

export function entryMap(entries: HabitEntry[], habitId: string): Map<string, HabitEntry> {
  return new Map(getHabitEntries(entries, habitId).map(e => [e.date, e]))
}

export function isKnown(value: EntryValue | undefined): boolean {
  return value !== undefined && value !== 'UNKNOWN' && entryToInt(value) !== ENTRY.UNKNOWN
}

export function successForDisplay(habit: Habit, value: EntryValue | undefined): boolean {
  const raw = entryToInt(value)
  if (raw === ENTRY.UNKNOWN) return false
  if (raw === ENTRY.SKIP) return true
  if (habit.type === 'YES_NO') return raw === ENTRY.YES_MANUAL || raw === ENTRY.YES_AUTO

  const amount = numericAmount(value)
  if (habit.targetType === 'AT_MOST') return amount <= (habit.targetValue ?? 0)
  return amount >= (habit.targetValue ?? 1)
}

export function successForStreak(habit: Habit, value: EntryValue | undefined): boolean {
  if (value === undefined && habit.type === 'NUMERICAL' && habit.targetType === 'AT_MOST') {
    return 0 <= (habit.targetValue ?? 0)
  }
  return successForDisplay(habit, value)
}

export function displayValue(habit: Habit, value: EntryValue | undefined): string {
  const raw = entryToInt(value)
  if (raw === ENTRY.UNKNOWN) return ''

  if (habit.type === 'YES_NO') {
    if (raw === ENTRY.YES_MANUAL || raw === ENTRY.YES_AUTO) return '✓'
    if (raw === ENTRY.SKIP) return '–'
    return '×'
  }

  if (raw === ENTRY.NO) return '0'
  if (raw === ENTRY.SKIP) return '–'
  return formatNumber(raw / 1000)
}

export function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

export function scoreCompute(frequency: number, previousScore: number, checkmarkValue: number): number {
  const multiplier = Math.pow(0.5, Math.sqrt(frequency) / 13.0)
  return previousScore * multiplier + checkmarkValue * (1 - multiplier)
}

export function scoreSeries(habit: Habit, entries: HabitEntry[], toDate = referenceDateForHabit(habit, entries)): ScorePoint[] {
  const habitEntries = getHabitEntries(entries, habit.id)
  const oldest = minISO(habitEntries.map(e => e.date))
  if (!oldest) return []

  const map = new Map(habitEntries.map(e => [e.date, e.value]))
  const dates = daysBetween(oldest, toDate)
  const rawValues = dates.map(date => entryToInt(map.get(date)))

  let rollingSum = 0.0
  let numerator = habit.frequencyNumerator
  let denominator = Math.max(1, habit.frequencyDenominator)
  const freq = numerator / denominator
  const isNumerical = habit.type === 'NUMERICAL'
  const isAtMost = habit.targetType === 'AT_MOST'

  if (!isNumerical && freq < 1.0) {
    numerator *= 2
    denominator *= 2
  }

  let previousValue = isNumerical && isAtMost ? 1.0 : 0.0
  const out: ScorePoint[] = []

  for (let i = 0; i < rawValues.length; i++) {
    const value = rawValues[i]

    if (isNumerical) {
      rollingSum += Math.max(0, value)
      if (i - denominator >= 0) rollingSum -= Math.max(0, rawValues[i - denominator])

      if (value !== ENTRY.SKIP) {
        const normalizedRollingSum = rollingSum / 1000
        let percentageCompleted: number
        if (!isAtMost) {
          percentageCompleted = (habit.targetValue ?? 0) > 0
            ? Math.min(1.0, normalizedRollingSum / (habit.targetValue ?? 1))
            : 1.0
        } else {
          const target = habit.targetValue ?? 0
          percentageCompleted = target > 0
            ? clamp01(1 - ((normalizedRollingSum - target) / target))
            : normalizedRollingSum > 0 ? 0.0 : 1.0
        }
        previousValue = scoreCompute(freq, previousValue, percentageCompleted)
      }
    } else {
      if (value === ENTRY.YES_MANUAL) rollingSum += 1.0
      if (i - denominator >= 0 && rawValues[i - denominator] === ENTRY.YES_MANUAL) rollingSum -= 1.0

      if (value !== ENTRY.SKIP) {
        const percentageCompleted = Math.min(1.0, rollingSum / numerator)
        previousValue = scoreCompute(freq, previousValue, percentageCompleted)
      }
    }

    out.push({ date: dates[i], score: previousValue })
  }

  return out
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function latestScore(habit: Habit, entries: HabitEntry[], date = referenceDateForHabit(habit, entries)): number {
  const series = scoreSeries(habit, entries, date)
  return series.length ? series[series.length - 1].score : 0
}

export function scoreAtOrBefore(series: ScorePoint[], date: string): ScorePoint | null {
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].date <= date) return series[i]
  }
  return null
}

export function scoreChartPoints(habit: Habit, entries: HabitEntry[], period: PeriodKind, pageOffset: number, referenceDate: string): ScorePoint[] {
  const series = scoreSeries(habit, entries, referenceDate)
  if (!series.length) return []

  const points = period === 'week' ? 12 : period === 'month' ? 12 : period === 'quarter' ? 8 : 6
  const stepMonths = period === 'week' ? 0 : period === 'month' ? 1 : period === 'quarter' ? 3 : 12
  const stepDays = period === 'week' ? 7 : 0

  let anchor = referenceDate
  if (period === 'week') anchor = addDays(referenceDate, -pageOffset * stepDays * points)
  else anchor = addMonths(referenceDate, -pageOffset * stepMonths * points)

  const dates: string[] = []
  for (let i = points - 1; i >= 0; i--) {
    const d = stepDays ? addDays(anchor, -i * stepDays) : addMonths(anchor, -i * stepMonths)
    dates.push(clampISO(d, series[0].date, referenceDate))
  }

  const unique = [...new Set(dates)]
  return unique.map(date => scoreAtOrBefore(series, date)).filter((p): p is ScorePoint => p !== null)
}

export function periodRange(period: 'today' | 'week' | 'month' | 'quarter' | 'year', referenceDate: string): { start: string, end: string } {
  if (period === 'today') return { start: referenceDate, end: referenceDate }
  if (period === 'week') return { start: startOfWeekMonday(referenceDate), end: referenceDate }
  if (period === 'month') return { start: startOfMonth(referenceDate), end: referenceDate }
  if (period === 'quarter') return { start: startOfQuarter(referenceDate), end: referenceDate }
  return { start: startOfYear(referenceDate), end: referenceDate }
}

export function periodTotal(habit: Habit, entries: HabitEntry[], period: 'today' | 'week' | 'month' | 'quarter' | 'year', referenceDate: string): number {
  const range = periodRange(period, referenceDate)
  return getHabitEntries(entries, habit.id)
    .filter(e => e.date >= range.start && e.date <= range.end)
    .reduce((acc, e) => {
      if (habit.type === 'NUMERICAL') return acc + numericAmount(e.value)
      return acc + (successForDisplay(habit, e.value) ? 1 : 0)
    }, 0)
}

export function historyPoints(habit: Habit, entries: HabitEntry[], period: PeriodKind, pageOffset: number, referenceDate: string): HistoryPoint[] {
  const count = period === 'month' ? 12 : period === 'quarter' ? 8 : period === 'week' ? 12 : 6
  const stepMonths = period === 'month' ? 1 : period === 'quarter' ? 3 : period === 'year' ? 12 : 0
  const stepDays = period === 'week' ? 7 : 0
  const shiftedReference = stepDays
    ? addDays(referenceDate, -pageOffset * stepDays * count)
    : addMonths(referenceDate, -pageOffset * stepMonths * count)

  const points: HistoryPoint[] = []

  for (let i = count - 1; i >= 0; i--) {
    let start: string
    let end: string
    if (period === 'week') {
      const anchor = addDays(shiftedReference, -i * 7)
      start = startOfWeekMonday(anchor)
      end = addDays(start, 6)
    } else if (period === 'month') {
      const anchor = addMonths(shiftedReference, -i)
      start = startOfMonth(anchor)
      end = endOfMonth(anchor)
    } else if (period === 'quarter') {
      const anchor = addMonths(shiftedReference, -i * 3)
      start = startOfQuarter(anchor)
      end = endOfQuarter(anchor)
    } else {
      const anchor = addMonths(shiftedReference, -i * 12)
      start = startOfYear(anchor)
      end = endOfYear(anchor)
    }

    const value = getHabitEntries(entries, habit.id)
      .filter(e => e.date >= start && e.date <= end)
      .reduce((acc, e) => {
        if (habit.type === 'NUMERICAL') return acc + numericAmount(e.value)
        return acc + (successForDisplay(habit, e.value) ? 1 : 0)
      }, 0)

    const label = period === 'week'
      ? formatShort(start)
      : period === 'year'
        ? start.slice(0, 4)
        : monthLabel(start)

    points.push({ key: `${period}-${start}`, label, start, end, value })
  }

  return points
}

export function bestStreaks(habit: Habit, entries: HabitEntry[], referenceDate: string, limit = 8): Streak[] {
  const habitEntries = getHabitEntries(entries, habit.id)
  const oldest = minISO(habitEntries.map(e => e.date))
  if (!oldest) return []
  const map = entryMap(entries, habit.id)
  const out: Streak[] = []

  let start: string | null = null
  let end: string | null = null
  let count = 0

  for (const date of daysBetween(oldest, referenceDate)) {
    const ok = successForStreak(habit, map.get(date)?.value)
    if (ok) {
      start ??= date
      end = date
      count++
    } else if (count > 0 && start && end) {
      out.push({ start, end, days: count })
      start = null
      end = null
      count = 0
    }
  }

  if (count > 0 && start && end) out.push({ start, end, days: count })
  return out.sort((a, b) => b.days - a.days || a.start.localeCompare(b.start)).slice(0, limit)
}

export function weekdayFrequency(habit: Habit, entries: HabitEntry[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0]
  getHabitEntries(entries, habit.id).forEach(e => {
    const value = habit.type === 'NUMERICAL'
      ? numericAmount(e.value)
      : successForDisplay(habit, e.value) ? 1 : 0
    out[weekDayIndexMonday(e.date)] += value
  })
  return out
}

export function calendarMatrix(referenceDate: string, pageOffsetWeeks: number, visibleWeeks = 17): { weeks: string[], rows: { label: string, dates: string[] }[] } {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const endWeekStart = startOfWeekMonday(addDays(referenceDate, -pageOffsetWeeks * 7))
  const start = addDays(endWeekStart, -(visibleWeeks - 1) * 7)
  const weeks = Array.from({ length: visibleWeeks }, (_, i) => addDays(start, i * 7))
  const rows = labels.map((label, day) => ({
    label,
    dates: weeks.map(weekStart => addDays(weekStart, day))
  }))
  return { weeks, rows }
}

export function monthMarkers(weeks: string[]): { week: string, label: string }[] {
  const out: { week: string, label: string }[] = []
  let previous = ''
  for (const week of weeks) {
    const month = week.slice(0, 7)
    if (month !== previous) {
      out.push({ week, label: parseISODate(week).toLocaleDateString('en-US', { month: 'short', year: week.endsWith('-01') ? 'numeric' : undefined }) })
      previous = month
    }
  }
  return out
}

export function upsertEntry(entries: HabitEntry[], habit: Habit, date: string, rawValue: string, notes = ''): HabitEntry[] {
  let value: EntryValue
  if (habit.type === 'YES_NO') {
    const normalized = rawValue.trim().toLowerCase()
    if (['yes', 'si', 'sí', 'true', '1', '✓'].includes(normalized)) value = 'YES_MANUAL'
    else if (['skip', '-', 'saltado'].includes(normalized)) value = 'SKIP'
    else if (['unknown', '?', ''].includes(normalized)) value = 'UNKNOWN'
    else value = 'NO'
  } else {
    const n = Number(rawValue.replace(',', '.'))
    value = Number.isFinite(n) ? Math.round(n * 1000) : 'UNKNOWN'
  }

  const existing = entries.find(e => e.habitId === habit.id && e.date === date)
  const timestamp = nowISO()
  if (existing) {
    return entries.map(e => e.id === existing.id ? { ...e, value, notes, updatedAt: timestamp } : e)
  }
  return [...entries, { id: createId(), habitId: habit.id, date, value, notes, createdAt: timestamp, updatedAt: timestamp }]
}

export function toggleEntry(entries: HabitEntry[], habit: Habit, date: string): HabitEntry[] {
  const existing = entries.find(e => e.habitId === habit.id && e.date === date)
  if (habit.type === 'NUMERICAL') {
    const next = numericAmount(existing?.value) > 0 ? '0' : '1'
    return upsertEntry(entries, habit, date, next, existing?.notes ?? '')
  }

  const raw = entryToInt(existing?.value)
  const next = raw === ENTRY.YES_MANUAL || raw === ENTRY.YES_AUTO ? 'no' : 'yes'
  return upsertEntry(entries, habit, date, next, existing?.notes ?? '')
}

export function defaultHabit(position: number): Habit {
  const timestamp = nowISO()
  return {
    id: createId(),
    position: String(position).padStart(3, '0'),
    name: 'New habit',
    type: 'YES_NO',
    question: '',
    description: '',
    frequencyNumerator: 1,
    frequencyDenominator: 1,
    color: '#8E24AA',
    unit: '',
    targetType: '',
    targetValue: null,
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

export function normalizeHabit(habit: Habit): Habit {
  return {
    ...habit,
    frequencyNumerator: Math.max(1, Math.round(habit.frequencyNumerator || 1)),
    frequencyDenominator: Math.max(1, Math.round(habit.frequencyDenominator || 1)),
    targetType: habit.type === 'NUMERICAL' ? (habit.targetType || 'AT_LEAST') : '',
    targetValue: habit.type === 'NUMERICAL' ? (habit.targetValue ?? 1) : null,
    updatedAt: nowISO()
  }
}

export function cropText(value: string, max = 42): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function dateDistanceLabel(start: string, end: string): string {
  const d = Math.abs(daysUntil(start, end))
  if (d === 0) return 'today'
  if (d === 1) return '1 day'
  return `${d} days`
}

export function monthName(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', { month: 'short' })
}

export function dateFromInput(value: string): string {
  return toISODate(parseISODate(value))
}
