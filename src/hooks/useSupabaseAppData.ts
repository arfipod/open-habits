import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppData, Habit, HabitEntry } from '../types'
import { parseLoopZip } from '../lib/csv'
import {
  appendUserDataFromImport,
  createHabit,
  deleteEntry as deleteEntryFromSupabase,
  deleteHabit as deleteHabitFromSupabase,
  exportableDataForUser as loadExportableDataForUser,
  fetchAppData,
  replaceAllUserDataFromImport,
  updateHabit,
  upsertEntry as upsertEntryInSupabase
} from '../lib/supabase/repositories'

const emptyData: AppData = { habits: [], entries: [] }

export function useSupabaseAppData(userId: string | null) {
  const [data, setData] = useState<AppData>(emptyData)
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState<string | null>(null)
  const dataRef = useRef<AppData>(emptyData)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  const refresh = useCallback(async (): Promise<AppData> => {
    if (!userId) {
      setData(emptyData)
      setLoading(false)
      return emptyData
    }

    setLoading(true)
    setError(null)
    try {
      const next = await fetchAppData(userId)
      setData(next)
      return next
    } catch (refreshError) {
      const message = errorMessage(refreshError, 'Could not load habits.')
      setError(message)
      throw refreshError
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    let ignore = false

    async function load() {
      if (!userId) {
        setData(emptyData)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const next = await fetchAppData(userId)
        if (!ignore) setData(next)
      } catch (loadError) {
        if (!ignore) setError(errorMessage(loadError, 'Could not load habits.'))
      } finally {
        if (!ignore) setLoading(false)
      }
    }

    void load()
    return () => {
      ignore = true
    }
  }, [userId])

  const saveHabit = useCallback(async (habit: Habit): Promise<Habit> => {
    if (!userId) throw new Error('Sign in before saving habits.')

    const previous = dataRef.current
    const exists = previous.habits.some(existing => existing.id === habit.id)
    setData(mergeHabit(previous, habit))
    setError(null)

    try {
      const saved = exists
        ? await updateHabit(habit, { userId })
        : await createHabit(habit, { userId })
      setData(current => mergeHabit(current, saved))
      return saved
    } catch (saveError) {
      setData(previous)
      setError(errorMessage(saveError, 'Could not save habit.'))
      throw saveError
    }
  }, [userId])

  const deleteHabit = useCallback(async (habitId: string): Promise<void> => {
    if (!userId) throw new Error('Sign in before deleting habits.')

    const previous = dataRef.current
    setData({
      habits: previous.habits.filter(habit => habit.id !== habitId),
      entries: previous.entries.filter(entry => entry.habitId !== habitId)
    })
    setError(null)

    try {
      await deleteHabitFromSupabase(habitId, { userId })
    } catch (deleteError) {
      setData(previous)
      setError(errorMessage(deleteError, 'Could not delete habit.'))
      throw deleteError
    }
  }, [userId])

  const upsertEntry = useCallback(async (entry: HabitEntry): Promise<HabitEntry> => {
    if (!userId) throw new Error('Sign in before saving entries.')

    const previous = dataRef.current
    setData(mergeEntry(previous, entry))
    setError(null)

    try {
      const saved = await upsertEntryInSupabase(entry, { userId })
      setData(current => mergeEntry(current, saved))
      return saved
    } catch (upsertError) {
      setData(previous)
      setError(errorMessage(upsertError, 'Could not save entry.'))
      throw upsertError
    }
  }, [userId])

  const deleteEntry = useCallback(async (entryId: string): Promise<void> => {
    if (!userId) throw new Error('Sign in before deleting entries.')

    const previous = dataRef.current
    setData({
      ...previous,
      entries: previous.entries.filter(entry => entry.id !== entryId)
    })
    setError(null)

    try {
      await deleteEntryFromSupabase(entryId, { userId })
    } catch (deleteError) {
      setData(previous)
      setError(errorMessage(deleteError, 'Could not delete entry.'))
      throw deleteError
    }
  }, [userId])

  const importData = useCallback(async (file: File, replaceCurrent: boolean): Promise<AppData> => {
    if (!userId) throw new Error('Sign in before importing data.')

    setLoading(true)
    setError(null)
    try {
      const parsed = await parseLoopZip(file)
      const next = replaceCurrent
        ? await replaceAllUserDataFromImport(parsed, file.name, { userId })
        : await appendUserDataFromImport(parsed, file.name, { userId })
      setData(next)
      return next
    } catch (importError) {
      setError(errorMessage(importError, 'Could not import the ZIP.'))
      throw importError
    } finally {
      setLoading(false)
    }
  }, [userId])

  const exportableDataForUser = useCallback(async (): Promise<AppData> => {
    if (!userId) throw new Error('Sign in before exporting data.')

    setError(null)
    try {
      const next = await loadExportableDataForUser({ userId })
      setData(next)
      return next
    } catch (exportError) {
      setError(errorMessage(exportError, 'Could not load fresh export data.'))
      throw exportError
    }
  }, [userId])

  return {
    loading,
    error,
    data,
    refresh,
    saveHabit,
    deleteHabit,
    upsertEntry,
    deleteEntry,
    importData,
    exportableDataForUser,
    clearError: () => setError(null)
  }
}

function mergeHabit(data: AppData, habit: Habit): AppData {
  const exists = data.habits.some(existing => existing.id === habit.id)
  return sortData({
    ...data,
    habits: exists
      ? data.habits.map(existing => existing.id === habit.id ? habit : existing)
      : [...data.habits, habit]
  })
}

function mergeEntry(data: AppData, entry: HabitEntry): AppData {
  const entries = data.entries.filter(existing => (
    existing.id !== entry.id &&
    !(existing.habitId === entry.habitId && existing.date === entry.date)
  ))

  return sortData({
    ...data,
    entries: [...entries, entry]
  })
}

function sortData(data: AppData): AppData {
  return {
    habits: [...data.habits].sort((a, b) => a.position.localeCompare(b.position)),
    entries: [...data.entries].sort((a, b) => a.habitId.localeCompare(b.habitId) || b.date.localeCompare(a.date))
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
