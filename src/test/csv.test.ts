import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { defaultHabit, upsertEntry } from '../lib/calculations'
import { exportLoopZip, exportOpenHabitsBackupZip, importLoopZip, parseImportZip, parseLoopZip } from '../lib/csv'
import type { AppData } from '../types'

describe('Loop ZIP import/export', () => {
  it('parses a Loop-compatible ZIP into AppData without needing persistence', async () => {
    const file = await loopZipFile()

    const data = await parseLoopZip(file)

    expect(data.habits).toHaveLength(1)
    expect(data.entries).toHaveLength(1)
    expect(data.habits[0]).toMatchObject({
      name: 'Read',
      type: 'YES_NO',
      frequencyNumerator: 3,
      frequencyDenominator: 7
    })
    expect(data.entries[0]).toMatchObject({
      date: '2026-05-09',
      value: 'YES_MANUAL',
      notes: 'Morning'
    })
  })

  it('keeps importLoopZip merge behavior for compatibility', async () => {
    const currentHabit = defaultHabit(1)
    const file = await loopZipFile()

    const merged = await importLoopZip(file, false, { habits: [currentHabit], entries: [], entryContexts: [] })

    expect(merged.habits.map(habit => habit.name)).toContain(currentHabit.name)
    expect(merged.habits.map(habit => habit.name)).toContain('Read')
  })

  it('exports only Android-compatible habit and entry data', async () => {
    const habit = { ...defaultHabit(1), id: '11111111-1111-4111-8111-111111111111', name: 'Read' }
    const data: AppData = {
      habits: [habit],
      entries: upsertEntry([], habit, '2026-05-09', 'yes', 'Book notes'),
      entryContexts: [{
        id: '22222222-2222-4222-8222-222222222222',
        habitId: habit.id,
        entryId: '33333333-3333-4333-8333-333333333333',
        occurredAt: '2026-05-09T07:30:00',
        occurredTime: '07:30',
        locationText: 'Home office',
        comment: 'Felt focused',
        createdAt: '2026-05-09T07:31:00Z',
        updatedAt: '2026-05-09T07:31:00Z'
      }]
    }

    const blob = await exportLoopZip(data, new Set([habit.id]))
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const habitsCsv = await zip.file('Habits.csv')!.async('string')
    const checkmarksCsv = await zip.file('001 Read/Checkmarks.csv')!.async('string')
    const serialized = `${habitsCsv}\n${checkmarksCsv}`

    expect(zip.file('Checkmarks.csv')).toBeTruthy()
    expect(zip.file('Scores.csv')).toBeTruthy()
    expect(serialized).toContain('Book notes')
    expect(serialized).not.toContain('location_text')
    expect(serialized).not.toContain('occurred_at')
    expect(serialized).not.toContain('occurred_time')
    expect(serialized).not.toContain('comment')
    expect(serialized).not.toContain('Home office')
    expect(serialized).not.toContain('Felt focused')
    expect(serialized).not.toContain('user_id')
  })

  it('exports Open Habits full backup with contexts', async () => {
    const habit = { ...defaultHabit(1), id: '11111111-1111-4111-8111-111111111111', name: 'Read' }
    const entries = upsertEntry([], habit, '2026-05-09', 'yes', 'Book notes')
    const data: AppData = {
      habits: [habit],
      entries,
      entryContexts: [{
        id: '22222222-2222-4222-8222-222222222222',
        habitId: habit.id,
        entryId: entries[0].id,
        occurredAt: '2026-05-09T07:30:00',
        occurredTime: '07:30',
        locationText: 'Home office',
        comment: 'Felt focused',
        createdAt: '2026-05-09T07:31:00Z',
        updatedAt: '2026-05-09T07:31:00Z'
      }]
    }

    const blob = await exportOpenHabitsBackupZip(data)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const backup = JSON.parse(await zip.file('OpenHabits.json')!.async('string'))

    expect(zip.file('Habits.csv')).toBeTruthy()
    expect(zip.file('Checkmarks.csv')).toBeTruthy()
    expect(zip.file('Scores.csv')).toBeTruthy()
    expect(backup.backupVersion).toBe(1)
    expect(backup.contexts).toHaveLength(1)
    expect(backup.contexts[0]).toMatchObject({
      occurredTime: '07:30',
      locationText: 'Home office',
      comment: 'Felt focused'
    })
  })

  it('imports Open Habits backup contexts from OpenHabits.json', async () => {
    const habit = { ...defaultHabit(1), id: '11111111-1111-4111-8111-111111111111', name: 'Read' }
    const entries = upsertEntry([], habit, '2026-05-09', 'yes')
    const original: AppData = {
      habits: [habit],
      entries,
      entryContexts: [{
        id: '22222222-2222-4222-8222-222222222222',
        habitId: habit.id,
        entryId: entries[0].id,
        occurredAt: '2026-05-09T07:30:00',
        occurredTime: '07:30',
        locationText: 'Home office',
        comment: 'Felt focused',
        createdAt: '2026-05-09T07:31:00Z',
        updatedAt: '2026-05-09T07:31:00Z'
      }]
    }
    const blob = await exportOpenHabitsBackupZip(original)
    const file = new File([blob], 'backup.zip', { type: 'application/zip' })

    const parsed = await parseImportZip(file)

    expect(parsed.entryContexts).toHaveLength(1)
    expect(parsed.entryContexts[0]).toMatchObject({
      occurredTime: '07:30',
      locationText: 'Home office',
      comment: 'Felt focused'
    })
  })
})

async function loopZipFile(): Promise<File> {
  const zip = new JSZip()
  zip.file(
    'Habits.csv',
    [
      'Position,Name,Type,Question,Description,FrequencyNumerator,FrequencyDenominator,Color,Unit,Target Type,Target Value,Archived?',
      '001,Read,YES_NO,Did you read?,,3,7,#8E24AA,,,,false'
    ].join('\n')
  )
  zip.folder('001 Read')!.file('Checkmarks.csv', 'Date,Value,Notes\n2026-05-09,YES_MANUAL,Morning\n')
  const blob = await zip.generateAsync({ type: 'blob' })
  return new File([blob], 'loop.zip', { type: 'application/zip' })
}
