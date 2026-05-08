export function todayISO(): string {
  return toISODate(new Date())
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return toISODate(d)
}

export function daysBetween(start: string, end: string): string[] {
  const result: string[] = []
  let cur = start
  while (cur <= end) {
    result.push(cur)
    cur = addDays(cur, 1)
  }
  return result
}

export function lastNDays(n: number, end = todayISO()): string[] {
  const start = addDays(end, -(n - 1))
  return daysBetween(start, end)
}

export function formatShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function monthLabel(key: string): string {
  const d = new Date(`${key}-01T12:00:00`)
  return d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
}

export function weekDayIndex(iso: string): number {
  const d = new Date(`${iso}T12:00:00`)
  return (d.getDay() + 6) % 7
}
