import { AppData, EntryValue, Habit, HabitEntry, HabitEntryContext, HabitType, TargetType } from '../types'
import { createId, intToEntryValue, nowISO, scoreSeries } from './calculations'
import { formatNumber, numericAmount } from './calculations'

async function loadJSZip() {
  const { default: JSZip } = await import('jszip')
  return JSZip
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (ch === '"') {
      if (quoted && src[i + 1] === '"') {
        cell += '"'
        i++
      } else {
        quoted = !quoted
      }
    } else if (ch === ',' && !quoted) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' && !quoted) {
      row.push(cell)
      if (row.some(v => v.length > 0)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }

  row.push(cell)
  if (row.some(v => v.length > 0)) rows.push(row)
  return rows
}

function csvEscape(value: unknown): string {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function get(row: string[], header: string[], name: string): string {
  const index = header.indexOf(name)
  return index >= 0 ? row[index] ?? '' : ''
}

export function parseLoopEntryValue(raw: string): EntryValue {
  const value = raw.trim()
  if (!value) return 'UNKNOWN'
  if (value === 'YES_MANUAL' || value === 'YES_AUTO' || value === 'NO' || value === 'SKIP' || value === 'UNKNOWN') return value
  const n = Number(value)
  return Number.isFinite(n) ? intToEntryValue(n) : 'UNKNOWN'
}

export function serializeEntryValue(value: EntryValue): string {
  return typeof value === 'number' ? String(value) : value
}

function sanitizeFolderName(value: string): string {
  const sane = value.replace(/[^ a-zA-Z0-9._-]+/g, '').trim().slice(0, 100)
  return sane || 'Habit'
}

function habitFolderName(index: number, habit: Habit): string {
  return `${String(index + 1).padStart(3, '0')} ${sanitizeFolderName(habit.name)}/`
}

export async function parseLoopZip(file: File): Promise<AppData> {
  const JSZip = await loadJSZip()
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const habitsEntry = zip.file('Habits.csv')
  if (!habitsEntry) throw new Error('The ZIP does not contain Habits.csv')

  const rows = parseCsv(await habitsEntry.async('string'))
  if (rows.length < 2) throw new Error('Habits.csv does not contain any habits')

  const header = rows[0]
  const timestamp = nowISO()
  const importedHabits: Habit[] = rows.slice(1).map((row, index) => {
    const position = get(row, header, 'Position') || String(index + 1).padStart(3, '0')
    const type = (get(row, header, 'Type') || 'YES_NO') as HabitType
    const targetRaw = get(row, header, 'Target Value')
    return {
      id: createId(),
      position,
      name: get(row, header, 'Name') || `Habit ${position}`,
      type,
      question: get(row, header, 'Question'),
      description: get(row, header, 'Description'),
      frequencyNumerator: Number(get(row, header, 'FrequencyNumerator') || 1),
      frequencyDenominator: Number(get(row, header, 'FrequencyDenominator') || 1),
      color: get(row, header, 'Color') || '#8E24AA',
      unit: get(row, header, 'Unit'),
      targetType: (get(row, header, 'Target Type') || (type === 'NUMERICAL' ? 'AT_LEAST' : '')) as TargetType,
      targetValue: targetRaw === '' ? (type === 'NUMERICAL' ? 1 : null) : Number(targetRaw),
      archived: get(row, header, 'Archived?') === 'true',
      createdAt: timestamp,
      updatedAt: timestamp
    }
  })

  const byPosition = new Map(importedHabits.map(h => [h.position, h.id]))
  const byName = new Map(importedHabits.map(h => [h.name, h.id]))
  const importedEntries: HabitEntry[] = []
  const coveredHabits = new Set<string>()

  for (const path of Object.keys(zip.files)) {
    const match = path.match(/^(\d{3})\s.*\/Checkmarks\.csv$/)
    if (!match) continue
    const habitId = byPosition.get(match[1])
    if (!habitId) continue
    const entry = zip.file(path)
    if (!entry) continue

    const checkRows = parseCsv(await entry.async('string'))
    if (checkRows.length < 2) continue
    const checkHeader = checkRows[0]
    const dateIndex = checkHeader.indexOf('Date')
    const valueIndex = checkHeader.indexOf('Value')
    const notesIndex = checkHeader.indexOf('Notes')

    checkRows.slice(1).forEach(row => {
      const date = row[dateIndex]
      const rawValue = row[valueIndex]
      if (!date || rawValue === undefined || rawValue === '') return
      importedEntries.push({
        id: createId(),
        habitId,
        date,
        value: parseLoopEntryValue(rawValue),
        notes: notesIndex >= 0 ? row[notesIndex] ?? '' : '',
        createdAt: timestamp,
        updatedAt: timestamp
      })
    })
    coveredHabits.add(habitId)
  }

  const aggregate = zip.file('Checkmarks.csv')
  if (aggregate) {
    const aggregateRows = parseCsv(await aggregate.async('string'))
    if (aggregateRows.length >= 2) {
      const aggregateHeader = aggregateRows[0]
      aggregateRows.slice(1).forEach(row => {
        const date = row[0]
        if (!date) return
        for (let i = 1; i < aggregateHeader.length; i++) {
          const habitName = aggregateHeader[i]
          if (!habitName) continue
          const habitId = byName.get(habitName)
          if (!habitId || coveredHabits.has(habitId)) continue
          const rawValue = row[i]
          if (rawValue === undefined || rawValue === '') continue
          importedEntries.push({
            id: createId(),
            habitId,
            date,
            value: parseLoopEntryValue(rawValue),
            notes: '',
            createdAt: timestamp,
            updatedAt: timestamp
          })
        }
      })
    }
  }

  return sortData({ habits: importedHabits, entries: importedEntries, entryContexts: [] })
}

export async function importLoopZip(file: File, replaceCurrent: boolean, current: AppData): Promise<AppData> {
  const imported = await parseLoopZip(file)
  if (replaceCurrent) return imported
  return sortData({
    habits: [...current.habits, ...imported.habits],
    entries: [...current.entries, ...imported.entries],
    entryContexts: current.entryContexts
  })
}

function sortData(data: AppData): AppData {
  return {
    habits: [...data.habits].sort((a, b) => a.position.localeCompare(b.position)),
    entries: [...data.entries].sort((a, b) => a.habitId.localeCompare(b.habitId) || b.date.localeCompare(a.date)),
    entryContexts: [...data.entryContexts].sort((a, b) => a.habitId.localeCompare(b.habitId) || a.entryId.localeCompare(b.entryId))
  }
}

export async function exportLoopZip(data: AppData, selectedHabitIds: Set<string>, includeAllHabitMetadata = true): Promise<Blob> {
  const JSZip = await loadJSZip()
  const zip = new JSZip()
  const selectedHabits = data.habits.filter(h => selectedHabitIds.has(h.id))
  const metadataHabits = includeAllHabitMetadata ? data.habits : selectedHabits
  const selectedEntries = data.entries.filter(e => selectedHabitIds.has(e.habitId))

  zip.file('Habits.csv', buildHabitsCsv(metadataHabits))
  zip.file('Checkmarks.csv', buildAggregateCheckmarksCsv(selectedHabits, selectedEntries))
  zip.file('Scores.csv', buildAggregateScoresCsv(selectedHabits, selectedEntries))

  selectedHabits.forEach((habit, index) => {
    const folder = zip.folder(habitFolderName(index, habit))!
    folder.file('Checkmarks.csv', buildHabitCheckmarksCsv(habit, selectedEntries))
    folder.file('Scores.csv', buildHabitScoresCsv(habit, selectedEntries))
  })

  return zip.generateAsync({ type: 'blob' })
}

export async function exportOpenHabitsBackupZip(data: AppData): Promise<Blob> {
  const JSZip = await loadJSZip()
  const zip = new JSZip()
  zip.file('OpenHabits.json', JSON.stringify(openHabitsBackup(data), null, 2))
  zip.file('Habits.csv', buildHabitsCsv(data.habits))
  zip.file('Checkmarks.csv', buildAggregateCheckmarksCsv(data.habits, data.entries))
  zip.file('Scores.csv', buildAggregateScoresCsv(data.habits, data.entries))
  return zip.generateAsync({ type: 'blob' })
}

export async function parseOpenHabitsBackupZip(file: File): Promise<AppData> {
  const JSZip = await loadJSZip()
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const backupEntry = zip.file('OpenHabits.json')
  if (!backupEntry) throw new Error('The ZIP does not contain OpenHabits.json')

  const raw = JSON.parse(await backupEntry.async('string')) as Partial<OpenHabitsBackup>
  if (!Array.isArray(raw.habits) || !Array.isArray(raw.entries)) {
    throw new Error('OpenHabits.json is missing habits or entries.')
  }

  return sortData({
    habits: raw.habits,
    entries: raw.entries,
    entryContexts: Array.isArray(raw.contexts) ? raw.contexts : []
  })
}

export async function parseImportZip(file: File): Promise<AppData> {
  const JSZip = await loadJSZip()
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  return zip.file('OpenHabits.json')
    ? parseOpenHabitsBackupZip(file)
    : parseLoopZip(file)
}

interface OpenHabitsBackup {
  backupVersion: 1
  exportedAt: string
  habits: Habit[]
  entries: HabitEntry[]
  contexts: HabitEntryContext[]
}

function openHabitsBackup(data: AppData): OpenHabitsBackup {
  return {
    backupVersion: 1,
    exportedAt: nowISO(),
    habits: data.habits,
    entries: data.entries,
    contexts: data.entryContexts
  }
}

function buildHabitsCsv(habits: Habit[]): string {
  const rows = [
    ['Position', 'Name', 'Type', 'Question', 'Description', 'FrequencyNumerator', 'FrequencyDenominator', 'Color', 'Unit', 'Target Type', 'Target Value', 'Archived?'],
    ...habits.map((h, index) => [
      h.position || String(index + 1).padStart(3, '0'),
      h.name,
      h.type,
      h.question,
      h.description,
      h.frequencyNumerator,
      h.frequencyDenominator,
      h.color,
      h.unit,
      h.type === 'NUMERICAL' ? h.targetType : '',
      h.type === 'NUMERICAL' && h.targetValue !== null ? h.targetValue : '',
      h.archived
    ])
  ]
  return toCsv(rows)
}

function buildAggregateCheckmarksCsv(habits: Habit[], entries: HabitEntry[]): string {
  const dates = allDates(entries)
  const rows: unknown[][] = [['Date', ...habits.map(h => h.name), '']]
  dates.forEach(date => {
    rows.push([date, ...habits.map(h => serializeEntryValue(entries.find(e => e.habitId === h.id && e.date === date)?.value ?? 'UNKNOWN')), ''])
  })
  return toCsv(rows)
}

function buildAggregateScoresCsv(habits: Habit[], entries: HabitEntry[]): string {
  const dates = allDates(entries)
  const scoreMaps = new Map(habits.map(h => [h.id, new Map(scoreSeries(h, entries).map(s => [s.date, s.score]))]))
  const rows: unknown[][] = [['Date', ...habits.map(h => h.name), '']]
  dates.forEach(date => {
    rows.push([date, ...habits.map(h => (scoreMaps.get(h.id)?.get(date) ?? 0).toFixed(4)), ''])
  })
  return toCsv(rows)
}

function buildHabitCheckmarksCsv(habit: Habit, entries: HabitEntry[]): string {
  const rows: unknown[][] = [['Date', 'Value', 'Notes']]
  entries.filter(e => e.habitId === habit.id).sort((a, b) => b.date.localeCompare(a.date)).forEach(e => {
    rows.push([e.date, serializeEntryValue(e.value), e.notes])
  })
  return toCsv(rows)
}

function buildHabitScoresCsv(habit: Habit, entries: HabitEntry[]): string {
  const rows: unknown[][] = [['Date', 'Score']]
  scoreSeries(habit, entries).sort((a, b) => b.date.localeCompare(a.date)).forEach(s => {
    rows.push([s.date, s.score.toFixed(4)])
  })
  return toCsv(rows)
}

function allDates(entries: HabitEntry[]): string[] {
  return [...new Set(entries.map(e => e.date))].sort((a, b) => b.localeCompare(a))
}

function toCsv(rows: unknown[][]): string {
  return rows.map(row => row.map(csvEscape).join(',')).join('\n') + '\n'
}

export function exportDebugSummary(data: AppData): string {
  return data.habits.map(habit => {
    const entries = data.entries.filter(e => e.habitId === habit.id)
    const total = entries.reduce((sum, entry) => sum + numericAmount(entry.value), 0)
    return `${habit.position} ${habit.name}: ${entries.length} entries, numerical total ${formatNumber(total)}`
  }).join('\n')
}
