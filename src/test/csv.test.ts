import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { defaultHabit, upsertEntry } from '../lib/calculations'
import { exportDebugSummary, exportLoopZip, exportOpenHabitsBackupZip, importLoopZip, parseImportZip, parseLoopZip } from '../lib/csv'
import type { AppData } from '../types'
import { loopZipFile } from './fixtures/zip'

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

  it('imports numerical habits and scaled values from per-habit Checkmarks.csv files', async () => {
    const file = await loopZipFile({ numericalHabit: true })

    const data = await parseLoopZip(file)

    const water = data.habits.find(habit => habit.name === 'Water')
    expect(water).toMatchObject({
      type: 'NUMERICAL',
      targetType: 'AT_LEAST',
      targetValue: 2,
      unit: 'L'
    })
    expect(data.entries.find(entry => entry.habitId === water?.id)).toMatchObject({
      date: '2026-05-09',
      value: 2500,
      notes: 'Hydrated'
    })
  })

  it('falls back to aggregate Checkmarks.csv when per-habit checkmarks are absent', async () => {
    const file = await loopZipFile({ perHabitCheckmarks: false, aggregateCheckmarks: true, numericalHabit: true })

    const data = await parseLoopZip(file)

    const read = data.habits.find(habit => habit.name === 'Read')
    const water = data.habits.find(habit => habit.name === 'Water')
    expect(data.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ habitId: read?.id, date: '2026-05-08', value: 'YES_MANUAL' }),
      expect.objectContaining({ habitId: water?.id, date: '2026-05-08', value: 2000 })
    ]))
  })

  it('prefers per-habit Checkmarks.csv over aggregate values for the same habit', async () => {
    const file = await loopZipFile({ perHabitCheckmarks: true, aggregateCheckmarks: true })

    const data = await parseLoopZip(file)

    expect(data.entries).toHaveLength(1)
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

  it('can replace current data during importLoopZip', async () => {
    const currentHabit = { ...defaultHabit(1), name: 'Old habit' }
    const file = await loopZipFile()

    const replaced = await importLoopZip(file, true, { habits: [currentHabit], entries: [], entryContexts: [] })

    expect(replaced.habits.map(habit => habit.name)).toEqual(['Read'])
  })

  it('parses quoted CSV fields with commas and escaped quotes', async () => {
    const zip = new JSZip()
    zip.file(
      'Habits.csv',
      [
        'Position,Name,Type,Question,Description,FrequencyNumerator,FrequencyDenominator,Color,Unit,Target Type,Target Value,Archived?',
        '001,"Read, deeply",YES_NO,"Did you read?","Book ""notes""",1,1,#2F80ED,,,,false'
      ].join('\n')
    )
    zip.folder('001 Read deeply')!.file('Checkmarks.csv', 'Date,Value,Notes\n2026-05-09,YES_MANUAL,"Morning, ""quiet"""\n')
    const blob = await zip.generateAsync({ type: 'blob' })

    const data = await parseLoopZip(new File([blob], 'quoted.zip', { type: 'application/zip' }))

    expect(data.habits[0]).toMatchObject({
      name: 'Read, deeply',
      description: 'Book "notes"'
    })
    expect(data.entries[0].notes).toBe('Morning, "quiet"')
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

  it('can reimport the Android-compatible ZIP it exports', async () => {
    const habit = { ...defaultHabit(1), id: '11111111-1111-4111-8111-111111111111', name: 'Read' }
    const data: AppData = {
      habits: [habit],
      entries: upsertEntry([], habit, '2026-05-09', 'yes', 'Book notes'),
      entryContexts: []
    }

    const blob = await exportLoopZip(data, new Set([habit.id]))
    const parsed = await parseLoopZip(new File([blob], 'android.zip', { type: 'application/zip' }))

    expect(parsed.habits).toHaveLength(1)
    expect(parsed.habits[0].name).toBe('Read')
    expect(parsed.entries).toEqual([
      expect.objectContaining({
        date: '2026-05-09',
        value: 'YES_MANUAL',
        notes: 'Book notes'
      })
    ])
  })

  it('can limit Habits.csv metadata to only selected habits', async () => {
    const read = { ...defaultHabit(1), id: '11111111-1111-4111-8111-111111111111', name: 'Read' }
    const water = { ...defaultHabit(2), id: '22222222-2222-4222-8222-222222222222', name: 'Water' }
    const data: AppData = {
      habits: [read, water],
      entries: upsertEntry([], read, '2026-05-09', 'yes'),
      entryContexts: []
    }

    const blob = await exportLoopZip(data, new Set([read.id]), false)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const habitsCsv = await zip.file('Habits.csv')!.async('string')

    expect(habitsCsv).toContain('Read')
    expect(habitsCsv).not.toContain('Water')
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

  it('routes parseImportZip to Open Habits backup when OpenHabits.json exists', async () => {
    const habit = { ...defaultHabit(1), id: '11111111-1111-4111-8111-111111111111', name: 'Read' }
    const entries = upsertEntry([], habit, '2026-05-09', 'yes')
    const blob = await exportOpenHabitsBackupZip({ habits: [habit], entries, entryContexts: [] })

    const parsed = await parseImportZip(new File([blob], 'backup.zip', { type: 'application/zip' }))

    expect(parsed.habits[0].id).toBe(habit.id)
    expect(parsed.entries[0].habitId).toBe(habit.id)
  })

  it('produces a human-readable debug summary', () => {
    const habit = { ...defaultHabit(1), id: '11111111-1111-4111-8111-111111111111', name: 'Water', type: 'NUMERICAL' as const, targetType: 'AT_LEAST' as const, targetValue: 2 }
    const data: AppData = {
      habits: [habit],
      entries: upsertEntry([], habit, '2026-05-09', '1.5'),
      entryContexts: []
    }

    expect(exportDebugSummary(data)).toContain('001 Water: 1 entries, numerical total 1.5')
  })

  it('rejects ZIP files without required import files', async () => {
    const zip = new JSZip()
    zip.file('Notes.txt', 'not a backup')
    const blob = await zip.generateAsync({ type: 'blob' })
    const file = new File([blob], 'bad.zip', { type: 'application/zip' })

    await expect(parseLoopZip(file)).rejects.toThrow('Habits.csv')
    await expect(parseImportZip(file)).rejects.toThrow('Habits.csv')
  })

  it('rejects malformed Open Habits backups', async () => {
    const zip = new JSZip()
    zip.file('OpenHabits.json', JSON.stringify({ backupVersion: 1, habits: 'bad', entries: [] }))
    const blob = await zip.generateAsync({ type: 'blob' })

    await expect(parseImportZip(new File([blob], 'bad-backup.zip', { type: 'application/zip' }))).rejects.toThrow('missing habits or entries')
  })
})
