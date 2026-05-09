import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppData, Habit, HabitEntry, HabitEntryContext } from '../types'
import { parseImportZip } from '../lib/csv'
import {
  appendUserDataFromImport,
  createHabit,
  deleteEntryContext as deleteEntryContextFromSupabase,
  deleteEntry as deleteEntryFromSupabase,
  deleteHabit as deleteHabitFromSupabase,
  exportableDataForUser as loadExportableDataForUser,
  fetchAppData,
  replaceAllUserDataFromImport,
  updateHabit,
  upsertEntryContext as upsertEntryContextInSupabase,
  upsertEntry as upsertEntryInSupabase
} from '../lib/supabase/repositories'

const emptyData: AppData = { habits: [], entries: [], entryContexts: [] }

export function useSupabaseAppData(userId: string | null) {
  const [data, setData] = useState<AppData>(emptyData)
  const [loading, setLoading] = useState(Boolean(userId))
  const [error, setError] = useState<string | null>(null)
  const dataRef = useRef<AppData>(emptyData)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  const commitData = useCallback((next: AppData | ((current: AppData) => AppData)) => {
    const resolved = typeof next === 'function' ? next(dataRef.current) : next
    dataRef.current = resolved
    setData(resolved)
  }, [])

  const refresh = useCallback(async (): Promise<AppData> => {
    if (!userId) {
      commitData(emptyData)
      setLoading(false)
      return emptyData
    }

    setLoading(true)
    setError(null)
    try {
      const next = await fetchAppData(userId)
      commitData(next)
      return next
    } catch (refreshError) {
      const message = errorMessage(refreshError, 'Could not load habits.')
      setError(message)
      throw refreshError
    } finally {
      setLoading(false)
    }
  }, [commitData, userId])

  useEffect(() => {
    let ignore = false

    async function load() {
      if (!userId) {
        commitData(emptyData)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const next = await fetchAppData(userId)
        if (!ignore) commitData(next)
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
  }, [commitData, userId])

  const saveHabit = useCallback(async (habit: Habit): Promise<Habit> => {
    if (!userId) throw new Error('Sign in before saving habits.')

    const previous = dataRef.current
    const exists = previous.habits.some(existing => existing.id === habit.id)
    commitData(mergeHabit(previous, habit))
    setError(null)

    try {
      const saved = exists
        ? await updateHabit(habit, { userId })
        : await createHabit(habit, { userId })
      commitData(current => mergeHabit(current, saved))
      return saved
    } catch (saveError) {
      commitData(previous)
      setError(errorMessage(saveError, 'Could not save habit.'))
      throw saveError
    }
  }, [commitData, userId])

  const deleteHabit = useCallback(async (habitId: string): Promise<void> => {
    if (!userId) throw new Error('Sign in before deleting habits.')

    const previous = dataRef.current
    commitData({
      habits: previous.habits.filter(habit => habit.id !== habitId),
      entries: previous.entries.filter(entry => entry.habitId !== habitId),
      entryContexts: previous.entryContexts.filter(context => context.habitId !== habitId)
    })
    setError(null)

    try {
      await deleteHabitFromSupabase(habitId, { userId })
    } catch (deleteError) {
      commitData(previous)
      setError(errorMessage(deleteError, 'Could not delete habit.'))
      throw deleteError
    }
  }, [commitData, userId])

  const upsertEntry = useCallback(async (entry: HabitEntry): Promise<HabitEntry> => {
    if (!userId) throw new Error('Sign in before saving entries.')

    const previous = dataRef.current
    commitData(mergeEntry(previous, entry))
    setError(null)

    try {
      const saved = await upsertEntryInSupabase(entry, { userId })
      commitData(current => mergeEntry(current, saved))
      return saved
    } catch (upsertError) {
      commitData(previous)
      setError(errorMessage(upsertError, 'Could not save entry.'))
      throw upsertError
    }
  }, [commitData, userId])

  const deleteEntry = useCallback(async (entryId: string): Promise<void> => {
    if (!userId) throw new Error('Sign in before deleting entries.')

    const previous = dataRef.current
    commitData({
      ...previous,
      entries: previous.entries.filter(entry => entry.id !== entryId),
      entryContexts: previous.entryContexts.filter(context => context.entryId !== entryId)
    })
    setError(null)

    try {
      await deleteEntryFromSupabase(entryId, { userId })
    } catch (deleteError) {
      commitData(previous)
      setError(errorMessage(deleteError, 'Could not delete entry.'))
      throw deleteError
    }
  }, [commitData, userId])

  const importData = useCallback(async (file: File, replaceCurrent: boolean): Promise<AppData> => {
    if (!userId) throw new Error('Sign in before importing data.')

    setLoading(true)
    setError(null)
    try {
      const parsed = await parseImportZip(file)
      const next = replaceCurrent
        ? await replaceAllUserDataFromImport(parsed, file.name, { userId })
        : await appendUserDataFromImport(parsed, file.name, { userId })
      commitData(next)
      return next
    } catch (importError) {
      setError(errorMessage(importError, 'Could not import the ZIP.'))
      throw importError
    } finally {
      setLoading(false)
    }
  }, [commitData, userId])

  const exportableDataForUser = useCallback(async (): Promise<AppData> => {
    if (!userId) throw new Error('Sign in before exporting data.')

    setError(null)
    try {
      const next = await loadExportableDataForUser({ userId })
      commitData(next)
      return next
    } catch (exportError) {
      setError(errorMessage(exportError, 'Could not load fresh export data.'))
      throw exportError
    }
  }, [commitData, userId])

  const upsertEntryContext = useCallback(async (context: HabitEntryContext): Promise<HabitEntryContext> => {
    if (!userId) throw new Error('Sign in before saving entry context.')

    const previous = dataRef.current
    commitData(mergeEntryContext(previous, context))
    setError(null)

    try {
      const saved = await upsertEntryContextInSupabase(context, { userId })
      commitData(current => mergeEntryContext(current, saved))
      return saved
    } catch (upsertError) {
      commitData(previous)
      setError(errorMessage(upsertError, 'Could not save entry context.'))
      throw upsertError
    }
  }, [commitData, userId])

  const deleteEntryContext = useCallback(async (entryId: string): Promise<void> => {
    if (!userId) throw new Error('Sign in before deleting entry context.')

    const previous = dataRef.current
    commitData({
      ...previous,
      entryContexts: previous.entryContexts.filter(context => context.entryId !== entryId)
    })
    setError(null)

    try {
      await deleteEntryContextFromSupabase(entryId, { userId })
    } catch (deleteError) {
      commitData(previous)
      setError(errorMessage(deleteError, 'Could not delete entry context.'))
      throw deleteError
    }
  }, [commitData, userId])

  return {
    loading,
    error,
    data,
    refresh,
    saveHabit,
    deleteHabit,
    upsertEntry,
    deleteEntry,
    upsertEntryContext,
    deleteEntryContext,
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

function mergeEntryContext(data: AppData, context: HabitEntryContext): AppData {
  const entryContexts = data.entryContexts.filter(existing => (
    existing.id !== context.id &&
    existing.entryId !== context.entryId
  ))

  return sortData({
    ...data,
    entryContexts: [...entryContexts, context]
  })
}

function sortData(data: AppData): AppData {
  return {
    habits: [...data.habits].sort((a, b) => a.position.localeCompare(b.position)),
    entries: [...data.entries].sort((a, b) => a.habitId.localeCompare(b.habitId) || b.date.localeCompare(a.date)),
    entryContexts: [...data.entryContexts].sort((a, b) => a.habitId.localeCompare(b.habitId) || a.entryId.localeCompare(b.entryId))
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
