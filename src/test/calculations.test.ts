import { describe, expect, it } from 'vitest'
import { createId, defaultHabit, toggleEntry, upsertEntry } from '../lib/calculations'

describe('entry editing calculations', () => {
  it('creates UUID-shaped ids for Supabase rows', () => {
    expect(createId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('toggles yes/no entries without changing unrelated entries', () => {
    const habit = defaultHabit(1)
    const otherHabit = defaultHabit(2)
    const otherEntries = upsertEntry([], otherHabit, '2026-05-09', 'yes')

    const next = toggleEntry(otherEntries, habit, '2026-05-09')

    expect(next).toHaveLength(2)
    expect(next.find(entry => entry.habitId === habit.id)?.value).toBe('YES_MANUAL')
    expect(next.find(entry => entry.habitId === otherHabit.id)?.value).toBe('YES_MANUAL')
  })

  it('stores numerical habit values scaled by 1000', () => {
    const habit = {
      ...defaultHabit(1),
      type: 'NUMERICAL' as const,
      targetType: 'AT_LEAST' as const,
      targetValue: 2
    }

    const entries = upsertEntry([], habit, '2026-05-09', '1.25')

    expect(entries[0].value).toBe(1250)
  })
})
