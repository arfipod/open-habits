export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function parseISODate(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

export function addDays(iso: string, delta: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + delta)
  return toISODate(d)
}

export function addMonths(iso: string, delta: number): string {
  const d = parseISODate(iso)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + delta)
  const last = lastDayOfMonth(toISODate(d)).getDate()
  d.setDate(Math.min(day, last))
  return toISODate(d)
}

export function lastDayOfMonth(iso: string): Date {
  const d = parseISODate(iso)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0)
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function endOfMonth(iso: string): string {
  return toISODate(lastDayOfMonth(iso))
}

export function startOfYear(iso: string): string {
  return `${iso.slice(0, 4)}-01-01`
}

export function endOfYear(iso: string): string {
  return `${iso.slice(0, 4)}-12-31`
}

export function startOfQuarter(iso: string): string {
  const d = parseISODate(iso)
  const qMonth = Math.floor(d.getMonth() / 3) * 3
  return `${d.getFullYear()}-${String(qMonth + 1).padStart(2, '0')}-01`
}

export function endOfQuarter(iso: string): string {
  return addDays(addMonths(startOfQuarter(iso), 3), -1)
}

export function startOfWeekMonday(iso: string): string {
  const d = parseISODate(iso)
  const mondayOffset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - mondayOffset)
  return toISODate(d)
}

export function daysBetween(start: string, end: string): string[] {
  if (start > end) return []
  const result: string[] = []
  let cur = start
  while (cur <= end) {
    result.push(cur)
    cur = addDays(cur, 1)
  }
  return result
}

export function weekDayIndexMonday(iso: string): number {
  const d = parseISODate(iso)
  return (d.getDay() + 6) % 7
}

export function maxISO(values: string[]): string | null {
  return values.length ? values.reduce((a, b) => (a > b ? a : b)) : null
}

export function minISO(values: string[]): string | null {
  return values.length ? values.reduce((a, b) => (a < b ? a : b)) : null
}

export function formatShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

export function formatLong(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function monthLabel(isoOrKey: string): string {
  const iso = isoOrKey.length === 7 ? `${isoOrKey}-01` : isoOrKey
  return parseISODate(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function shortMonth(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', { month: 'short' })
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

export function daysUntil(start: string, end: string): number {
  const a = parseISODate(start).getTime()
  const b = parseISODate(end).getTime()
  return Math.round((b - a) / 86_400_000)
}

export function clampISO(value: string, min: string, max: string): string {
  return value < min ? min : value > max ? max : value
}
