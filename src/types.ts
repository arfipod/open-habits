export type HabitType = 'YES_NO' | 'NUMERICAL'
export type TargetType = 'AT_LEAST' | 'AT_MOST' | ''
export type EntryValue = number | 'YES_MANUAL' | 'YES_AUTO' | 'NO' | 'SKIP' | 'UNKNOWN'

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
}

export interface HabitEntry {
  id: string
  habitId: string
  date: string
  value: EntryValue
  notes?: string
}

export interface AppData {
  habits: Habit[]
  entries: HabitEntry[]
}

export interface ScorePoint {
  date: string
  score: number
}

export interface Streak {
  start: string
  end: string
  days: number
}
