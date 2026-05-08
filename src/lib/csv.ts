import JSZip from 'jszip'
import { AppData, EntryValue, Habit, HabitEntry, HabitType, TargetType } from '../types'
import { scoreSeries } from './calculations'

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++ }
      else quoted = !quoted
    } else if (c === ',' && !quoted) {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out
}

function csvEscape(value: unknown): string {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}

function parseCsv(text: string): string[][] {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean).map(parseCsvLine)
}

function parseLoopValue(raw: string): EntryValue {
  if (raw === 'YES_MANUAL' || raw === 'YES_AUTO' || raw === 'NO' || raw === 'SKIP' || raw === 'UNKNOWN') return raw
  if (raw === '') return 'UNKNOWN'
  const n = Number(raw)
  return Number.isFinite(n) ? n : 'UNKNOWN'
}

function serializeValue(value: EntryValue): string {
  return typeof value === 'number' ? String(value) : value
}

function slugName(position: string, name: string): string {
  return `${position} ${name}`.replace(/[\\/:*?"<>|]/g, '-')
}

export async function importLoopZip(file: File, replaceCurrent: boolean, current: AppData): Promise<AppData> {
  const zip = await JSZip.loadAsync(file)
  const habitsFile = zip.file('Habits.csv')
  if (!habitsFile) throw new Error('Habits.csv not found in ZIP')

  const habitsText = await habitsFile.async('string')
  const rows = parseCsv(habitsText)
  const header = rows[0]
  const importedHabits: Habit[] = rows.slice(1).map(row => {
    const get = (name: string) => row[header.indexOf(name)] ?? ''
    const position = get('Position')
    return {
      id: crypto.randomUUID(),
      position,
      name: get('Name'),
      type: (get('Type') || 'YES_NO') as HabitType,
      question: get('Question'),
      description: get('Description'),
      frequencyNumerator: Number(get('FrequencyNumerator') || 1),
      frequencyDenominator: Number(get('FrequencyDenominator') || 1),
      color: get('Color') || '#8E24AA',
      unit: get('Unit'),
      targetType: (get('Target Type') || '') as TargetType,
      targetValue: get('Target Value') === '' ? null : Number(get('Target Value')),
      archived: get('Archived?') === 'true'
    }
  })

  const positionToId = new Map(importedHabits.map(h => [h.position, h.id]))
  const nameToId = new Map(importedHabits.map(h => [h.name, h.id]))
  const importedEntries: HabitEntry[] = []

  // Prefer per-habit Checkmarks.csv folders: "001 No PMO/Checkmarks.csv"
  for (const path of Object.keys(zip.files)) {
    const m = path.match(/^(\d+)\s.*\/Checkmarks\.csv$/)
    if (!m) continue
    const habitId = positionToId.get(m[1])
    if (!habitId) continue
    const text = await zip.file(path)!.async('string')
    const lines = parseCsv(text)
    const h = lines[0]
    const dateIdx = h.indexOf('Date')
    const valueIdx = h.indexOf('Value')
    const notesIdx = h.indexOf('Notes')
    for (const row of lines.slice(1)) {
      const date = row[dateIdx]
      const valueRaw = row[valueIdx]
      if (!date || valueRaw === undefined || valueRaw === '') continue
      importedEntries.push({
        id: crypto.randomUUID(),
        habitId,
        date,
        value: parseLoopValue(valueRaw),
        notes: notesIdx >= 0 ? row[notesIdx] : ''
      })
    }
  }

  // Fallback/use aggregate Checkmarks.csv for habits not covered by folders
  const coveredHabitIds = new Set(importedEntries.map(e => e.habitId))
  const aggregate = zip.file('Checkmarks.csv')
  if (aggregate) {
    const text = await aggregate.async('string')
    const lines = parseCsv(text)
    const header = lines[0]
    for (const row of lines.slice(1)) {
      const date = row[0]
      for (let i = 1; i < header.length; i++) {
        const habitName = header[i]
        const habitId = nameToId.get(habitName)
        if (!habitId || coveredHabitIds.has(habitId)) continue
        const raw = row[i]
        if (!date || raw === undefined || raw === '') continue
        importedEntries.push({ id: crypto.randomUUID(), habitId, date, value: parseLoopValue(raw) })
      }
    }
  }

  if (replaceCurrent) return { habits: importedHabits, entries: importedEntries }

  return {
    habits: [...current.habits, ...importedHabits],
    entries: [...current.entries, ...importedEntries]
  }
}

export async function exportLoopZip(data: AppData, selectedHabitIds: Set<string>): Promise<Blob> {
  const zip = new JSZip()
  const habits = data.habits.filter(h => selectedHabitIds.has(h.id))
  const entries = data.entries.filter(e => selectedHabitIds.has(e.habitId))
  const byHabit = new Map(habits.map(h => [h.id, h]))

  const habitsRows = [
    ['Position','Name','Type','Question','Description','FrequencyNumerator','FrequencyDenominator','Color','Unit','Target Type','Target Value','Archived?'],
    ...habits.map((h, idx) => [
      String(idx + 1).padStart(3, '0'), h.name, h.type, h.question, h.description,
      h.frequencyNumerator, h.frequencyDenominator, h.color, h.unit, h.targetType,
      h.targetValue ?? '', h.archived
    ])
  ]
  zip.file('Habits.csv', habitsRows.map(r => r.map(csvEscape).join(',')).join('\n'))

  const dates = [...new Set(entries.map(e => e.date))].sort().reverse()
  const aggregate = [['Date', ...habits.map(h => h.name), '']]
  for (const date of dates) {
    aggregate.push([date, ...habits.map(h => serializeValue(entries.find(e => e.habitId === h.id && e.date === date)?.value ?? 'UNKNOWN')), ''])
  }
  zip.file('Checkmarks.csv', aggregate.map(r => r.map(csvEscape).join(',')).join('\n'))

  const scoreRows = [['Date', ...habits.map(h => h.name), '']]
  for (const date of dates) {
    scoreRows.push([date, ...habits.map(h => {
      const s = scoreSeries(h, entries).find(p => p.date === date)
      return s ? s.score.toFixed(4) : ''
    }), ''])
  }
  zip.file('Scores.csv', scoreRows.map(r => r.map(csvEscape).join(',')).join('\n'))

  habits.forEach((h, idx) => {
    const position = String(idx + 1).padStart(3, '0')
    const folder = zip.folder(slugName(position, h.name))!
    const hEntries = entries.filter(e => e.habitId === h.id).sort((a, b) => b.date.localeCompare(a.date))
    const checkRows = [['Date','Value','Notes'], ...hEntries.map(e => [e.date, serializeValue(e.value), e.notes ?? ''])]
    folder.file('Checkmarks.csv', checkRows.map(r => r.map(csvEscape).join(',')).join('\n'))

    const scoreRows = [['Date','Score'], ...scoreSeries(h, entries).sort((a,b)=>b.date.localeCompare(a.date)).map(p => [p.date, p.score.toFixed(4)])]
    folder.file('Scores.csv', scoreRows.map(r => r.map(csvEscape).join(',')).join('\n'))
  })

  return zip.generateAsync({ type: 'blob' })
}
