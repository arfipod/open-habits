import { AppData } from '../types'

const KEY = 'open-habits-data-v2'

export function loadData(): AppData | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function clearData(): void {
  localStorage.removeItem(KEY)
}
