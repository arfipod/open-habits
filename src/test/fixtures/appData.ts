import type { AppData, EntryValue, Habit, HabitEntry, HabitEntryContext } from '../../types'

export const USER_ID = 'user-1'
export const FIXED_TIMESTAMP = '2026-05-09T08:00:00.000Z'

export function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'habit-read',
    position: '001',
    name: 'Read',
    type: 'YES_NO',
    question: 'Did you read?',
    description: 'Read a book',
    frequencyNumerator: 1,
    frequencyDenominator: 1,
    color: '#2F80ED',
    unit: '',
    targetType: '',
    targetValue: null,
    archived: false,
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    ...overrides
  }
}

export function makeNumericalHabit(overrides: Partial<Habit> = {}): Habit {
  return makeHabit({
    id: 'habit-water',
    position: '002',
    name: 'Water',
    type: 'NUMERICAL',
    question: 'How many liters?',
    unit: 'L',
    targetType: 'AT_LEAST',
    targetValue: 2,
    ...overrides
  })
}

export function makeEntry(overrides: Partial<HabitEntry> = {}): HabitEntry {
  return {
    id: `entry-${overrides.habitId ?? 'habit-read'}-${overrides.date ?? '2026-05-09'}`,
    habitId: 'habit-read',
    date: '2026-05-09',
    value: 'YES_MANUAL',
    notes: '',
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    ...overrides
  }
}

export function makeNumericEntry(date: string, amount: number, habitId = 'habit-water'): HabitEntry {
  return makeEntry({
    id: `entry-${habitId}-${date}`,
    habitId,
    date,
    value: Math.round(amount * 1000),
    notes: ''
  })
}

export function makeContext(overrides: Partial<HabitEntryContext> = {}): HabitEntryContext {
  return {
    id: 'context-1',
    habitId: 'habit-read',
    entryId: 'entry-habit-read-2026-05-09',
    occurredAt: '2026-05-09T07:30:00',
    occurredTime: '07:30',
    locationText: 'Home office',
    comment: 'Felt focused',
    createdAt: FIXED_TIMESTAMP,
    updatedAt: FIXED_TIMESTAMP,
    ...overrides
  }
}

export function sampleAppData(): AppData {
  const read = makeHabit()
  const water = makeNumericalHabit()
  const readEntry = makeEntry({ habitId: read.id, date: '2026-05-09', notes: 'Morning' })
  return {
    habits: [read, water],
    entries: [
      makeEntry({ habitId: read.id, date: '2026-05-06', value: 'YES_MANUAL' }),
      makeEntry({ habitId: read.id, date: '2026-05-07', value: 'NO' }),
      readEntry,
      makeNumericEntry('2026-05-09', 2.5, water.id)
    ],
    entryContexts: [makeContext({ habitId: read.id, entryId: readEntry.id })]
  }
}

export function entriesFor(habit: Habit, values: Array<[string, EntryValue]>): HabitEntry[] {
  return values.map(([date, value]) => makeEntry({
    id: `entry-${habit.id}-${date}`,
    habitId: habit.id,
    date,
    value
  }))
}
