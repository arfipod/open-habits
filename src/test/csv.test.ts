import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { defaultHabit, upsertEntry } from '../lib/calculations'
import { exportLoopZip, importLoopZip, parseLoopZip } from '../lib/csv'
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

    const merged = await importLoopZip(file, false, { habits: [currentHabit], entries: [] })

    expect(merged.habits.map(habit => habit.name)).toContain(currentHabit.name)
    expect(merged.habits.map(habit => habit.name)).toContain('Read')
  })

  it('exports only Android-compatible habit and entry data', async () => {
    const habit = { ...defaultHabit(1), id: '11111111-1111-4111-8111-111111111111', name: 'Read' }
    const data: AppData = {
      habits: [habit],
      entries: upsertEntry([], habit, '2026-05-09', 'yes', 'Book notes')
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
    expect(serialized).not.toContain('user_id')
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
