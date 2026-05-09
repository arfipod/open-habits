import type { EntryValue, Habit, HabitEntry, TargetType } from '../../types'
import type {
  EntryValueKindDb,
  HabitEntryInsert,
  HabitEntryRow,
  HabitEntryUpdate,
  HabitInsert,
  HabitRow,
  HabitUpdate,
  TargetTypeDb
} from './database.types'

export function habitRowToHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    position: row.position,
    name: row.name,
    type: row.type,
    question: row.question,
    description: row.description,
    frequencyNumerator: row.frequency_numerator,
    frequencyDenominator: row.frequency_denominator,
    color: row.color,
    unit: row.unit,
    targetType: dbTargetTypeToDomain(row.target_type),
    targetValue: row.target_value,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function habitToInsert(habit: Habit, userId: string): HabitInsert {
  return {
    id: habit.id,
    user_id: userId,
    position: habit.position,
    name: habit.name,
    type: habit.type,
    question: habit.question,
    description: habit.description,
    frequency_numerator: habit.frequencyNumerator,
    frequency_denominator: habit.frequencyDenominator,
    color: habit.color,
    unit: habit.unit,
    target_type: domainTargetTypeToDb(habit.targetType),
    target_value: habit.targetValue,
    archived: habit.archived,
    created_at: habit.createdAt,
    updated_at: habit.updatedAt
  }
}

export function habitToUpdate(habit: Habit): HabitUpdate {
  return {
    position: habit.position,
    name: habit.name,
    type: habit.type,
    question: habit.question,
    description: habit.description,
    frequency_numerator: habit.frequencyNumerator,
    frequency_denominator: habit.frequencyDenominator,
    color: habit.color,
    unit: habit.unit,
    target_type: domainTargetTypeToDb(habit.targetType),
    target_value: habit.targetValue,
    archived: habit.archived,
    updated_at: habit.updatedAt
  }
}

export function entryRowToHabitEntry(row: HabitEntryRow): HabitEntry {
  return {
    id: row.id,
    habitId: row.habit_id,
    date: row.date,
    value: entryValueFromDb(row.value_kind, row.numeric_value),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function entryToInsert(entry: HabitEntry, userId: string): HabitEntryInsert {
  return {
    id: entry.id,
    user_id: userId,
    habit_id: entry.habitId,
    date: entry.date,
    ...entryValueToDb(entry.value),
    notes: entry.notes,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt
  }
}

export function entryToUpdate(entry: HabitEntry): HabitEntryUpdate {
  return {
    habit_id: entry.habitId,
    date: entry.date,
    ...entryValueToDb(entry.value),
    notes: entry.notes,
    updated_at: entry.updatedAt
  }
}

export function entryValueToDb(value: EntryValue): Pick<HabitEntryRow, 'value_kind' | 'numeric_value'> {
  if (typeof value === 'number') {
    return {
      value_kind: 'NUMERIC',
      numeric_value: value
    }
  }

  return {
    value_kind: value,
    numeric_value: null
  }
}

export function entryValueFromDb(valueKind: EntryValueKindDb, numericValue: number | null): EntryValue {
  if (valueKind === 'NUMERIC') return numericValue ?? 0
  return valueKind
}

function domainTargetTypeToDb(targetType: TargetType): TargetTypeDb | null {
  return targetType === '' ? null : targetType
}

function dbTargetTypeToDomain(targetType: TargetTypeDb | null): TargetType {
  return targetType ?? ''
}
