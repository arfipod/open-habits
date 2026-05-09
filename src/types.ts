export type HabitType = 'YES_NO' | 'NUMERICAL'
export type TargetType = 'AT_LEAST' | 'AT_MOST' | ''
export type PeriodKind = 'week' | 'month' | 'quarter' | 'year'

export type EntryValue =
  | 'YES_MANUAL'
  | 'YES_AUTO'
  | 'NO'
  | 'SKIP'
  | 'UNKNOWN'
  | number

export interface Habit {
  id: string
  position: string
  name: string
  type: HabitType
  question: string
  description: string
  frequencyNumerator: number
  frequencyDenominator: number
  color: string
  unit: string
  targetType: TargetType
  targetValue: number | null
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface HabitEntry {
  id: string
  habitId: string
  date: string
  value: EntryValue
  notes: string
  createdAt: string
  updatedAt: string
}

export interface AppData {
  habits: Habit[]
  entries: HabitEntry[]
}

export interface ScorePoint {
  date: string
  score: number
}

export interface HistoryPoint {
  key: string
  label: string
  start: string
  end: string
  value: number
}

export interface Streak {
  start: string
  end: string
  days: number
}
