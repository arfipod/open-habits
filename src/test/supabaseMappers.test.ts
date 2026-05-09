import { describe, expect, it } from 'vitest'
import {
  contextRowToHabitEntryContext,
  contextToInsert,
  entryRowToHabitEntry,
  entryToInsert,
  entryToUpdate,
  entryValueFromDb,
  entryValueToDb,
  habitRowToHabit,
  habitToInsert,
  habitToUpdate
} from '../lib/supabase/mappers'
import type { HabitEntryContextRow, HabitEntryRow, HabitRow } from '../lib/supabase/database.types'
import { FIXED_TIMESTAMP, USER_ID, makeContext, makeEntry, makeHabit } from './fixtures/appData'

describe('Supabase mappers', () => {
  it('maps habit rows to domain habits and insert/update payloads', () => {
    const row: HabitRow = {
      id: 'habit-read',
      user_id: USER_ID,
      position: '001',
      name: 'Read',
      type: 'YES_NO',
      question: 'Did you read?',
      description: 'Read books',
      frequency_numerator: 3,
      frequency_denominator: 7,
      color: '#2F80ED',
      unit: '',
      target_type: null,
      target_value: null,
      archived: false,
      source: 'open_habits',
      external_id: null,
      created_at: FIXED_TIMESTAMP,
      updated_at: FIXED_TIMESTAMP
    }

    const habit = habitRowToHabit(row)

    expect(habit).toMatchObject({
      id: row.id,
      frequencyNumerator: 3,
      frequencyDenominator: 7,
      targetType: ''
    })
    expect(habitToInsert(habit, USER_ID)).toMatchObject({
      id: row.id,
      user_id: USER_ID,
      frequency_numerator: 3,
      frequency_denominator: 7,
      target_type: null
    })
    expect(habitToUpdate(habit)).toMatchObject({
      name: 'Read',
      target_type: null,
      updated_at: FIXED_TIMESTAMP
    })
  })

  it('maps numerical habit targets to database target enums', () => {
    const habit = makeHabit({
      type: 'NUMERICAL',
      targetType: 'AT_MOST',
      targetValue: 0,
      unit: 'times'
    })

    expect(habitToInsert(habit, USER_ID)).toMatchObject({
      type: 'NUMERICAL',
      target_type: 'AT_MOST',
      target_value: 0
    })
  })

  it('maps entry values to and from database columns', () => {
    expect(entryValueToDb('YES_MANUAL')).toEqual({ value_kind: 'YES_MANUAL', numeric_value: null })
    expect(entryValueToDb('YES_AUTO')).toEqual({ value_kind: 'YES_AUTO', numeric_value: null })
    expect(entryValueToDb('NO')).toEqual({ value_kind: 'NO', numeric_value: null })
    expect(entryValueToDb('SKIP')).toEqual({ value_kind: 'SKIP', numeric_value: null })
    expect(entryValueToDb('UNKNOWN')).toEqual({ value_kind: 'UNKNOWN', numeric_value: null })
    expect(entryValueToDb(2500)).toEqual({ value_kind: 'NUMERIC', numeric_value: 2500 })

    expect(entryValueFromDb('NUMERIC', 2500)).toBe(2500)
    expect(entryValueFromDb('NUMERIC', null)).toBe(0)
    expect(entryValueFromDb('SKIP', null)).toBe('SKIP')
  })

  it('maps entry rows and payloads', () => {
    const row: HabitEntryRow = {
      id: 'entry-1',
      user_id: USER_ID,
      habit_id: 'habit-read',
      date: '2026-05-09',
      value_kind: 'NUMERIC',
      numeric_value: 1250,
      notes: 'Loop note',
      created_at: FIXED_TIMESTAMP,
      updated_at: FIXED_TIMESTAMP
    }

    const entry = entryRowToHabitEntry(row)

    expect(entry).toMatchObject({
      id: 'entry-1',
      habitId: 'habit-read',
      value: 1250,
      notes: 'Loop note'
    })
    expect(entryToInsert(entry, USER_ID)).toMatchObject({
      user_id: USER_ID,
      habit_id: 'habit-read',
      value_kind: 'NUMERIC',
      numeric_value: 1250
    })
    expect(entryToUpdate(entry)).toMatchObject({
      habit_id: 'habit-read',
      date: '2026-05-09',
      value_kind: 'NUMERIC'
    })
  })

  it('maps optional entry contexts both ways', () => {
    const row: HabitEntryContextRow = {
      id: 'context-1',
      user_id: USER_ID,
      habit_id: 'habit-read',
      entry_id: 'entry-1',
      occurred_at: '2026-05-09T07:30:00',
      occurred_time: '07:30',
      location_text: null,
      comment: null,
      created_at: FIXED_TIMESTAMP,
      updated_at: FIXED_TIMESTAMP
    }

    const context = contextRowToHabitEntryContext(row)

    expect(context).toMatchObject({
      habitId: 'habit-read',
      entryId: 'entry-1',
      locationText: '',
      comment: ''
    })
    expect(contextToInsert(makeContext({ entryId: 'entry-1' }), USER_ID)).toMatchObject({
      user_id: USER_ID,
      habit_id: 'habit-read',
      entry_id: 'entry-1',
      location_text: 'Home office',
      comment: 'Felt focused'
    })
  })

  it('maps standard entry fixtures to database inserts', () => {
    const entry = makeEntry({ value: 'UNKNOWN' })

    expect(entryToInsert(entry, USER_ID)).toMatchObject({
      value_kind: 'UNKNOWN',
      numeric_value: null,
      user_id: USER_ID
    })
  })
})
