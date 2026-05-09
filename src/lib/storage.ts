const SELECTED_HABIT_KEY = 'open-habits:selectedHabitId'

export function loadSelectedHabitId(): string | null {
  try {
    return localStorage.getItem(SELECTED_HABIT_KEY)
  } catch {
    return null
  }
}

export function saveSelectedHabitId(habitId: string | null): void {
  try {
    if (habitId) localStorage.setItem(SELECTED_HABIT_KEY, habitId)
    else localStorage.removeItem(SELECTED_HABIT_KEY)
  } catch {
    // UI preferences are best-effort only.
  }
}
