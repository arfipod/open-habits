import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSupabaseAppData } from '../hooks/useSupabaseAppData'
import { USER_ID, makeContext, makeEntry, makeHabit, sampleAppData } from './fixtures/appData'
import type { AppData } from '../types'

const mocks = vi.hoisted(() => ({
  appendUserDataFromImport: vi.fn(),
  createHabit: vi.fn(),
  deleteEntry: vi.fn(),
  deleteEntryContext: vi.fn(),
  deleteHabit: vi.fn(),
  exportableDataForUser: vi.fn(),
  fetchAppData: vi.fn(),
  replaceAllUserDataFromImport: vi.fn(),
  updateHabit: vi.fn(),
  upsertEntry: vi.fn(),
  upsertEntryContext: vi.fn(),
  parseImportZip: vi.fn()
}))

vi.mock('../lib/supabase/repositories', () => ({
  appendUserDataFromImport: mocks.appendUserDataFromImport,
  createHabit: mocks.createHabit,
  deleteEntry: mocks.deleteEntry,
  deleteEntryContext: mocks.deleteEntryContext,
  deleteHabit: mocks.deleteHabit,
  exportableDataForUser: mocks.exportableDataForUser,
  fetchAppData: mocks.fetchAppData,
  replaceAllUserDataFromImport: mocks.replaceAllUserDataFromImport,
  updateHabit: mocks.updateHabit,
  upsertEntry: mocks.upsertEntry,
  upsertEntryContext: mocks.upsertEntryContext
}))

vi.mock('../lib/csv', () => ({
  parseImportZip: mocks.parseImportZip
}))

describe('useSupabaseAppData', () => {
  beforeEach(() => {
    const data = sampleAppData()
    mocks.fetchAppData.mockResolvedValue(data)
    mocks.createHabit.mockImplementation(async habit => habit)
    mocks.updateHabit.mockImplementation(async habit => habit)
    mocks.deleteHabit.mockResolvedValue(undefined)
    mocks.upsertEntry.mockImplementation(async entry => entry)
    mocks.deleteEntry.mockResolvedValue(undefined)
    mocks.upsertEntryContext.mockImplementation(async context => context)
    mocks.deleteEntryContext.mockResolvedValue(undefined)
    mocks.parseImportZip.mockResolvedValue(data)
    mocks.replaceAllUserDataFromImport.mockResolvedValue(data)
    mocks.appendUserDataFromImport.mockResolvedValue(data)
    mocks.exportableDataForUser.mockResolvedValue(data)
  })

  it('loads app data for a signed-in user', async () => {
    const { result } = renderHook(() => useSupabaseAppData(USER_ID))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mocks.fetchAppData).toHaveBeenCalledWith(USER_ID)
    expect(result.current.data.habits.map(habit => habit.name)).toContain('Read')
    expect(result.current.error).toBeNull()
  })

  it('creates, updates and deletes habits with optimistic state', async () => {
    const { result } = renderHook(() => useSupabaseAppData(USER_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const newHabit = makeHabit({ id: 'habit-meditate', position: '003', name: 'Meditate' })
    await act(async () => {
      await result.current.saveHabit(newHabit)
    })

    expect(mocks.createHabit).toHaveBeenCalledWith(newHabit, { userId: USER_ID })
    expect(result.current.data.habits.map(habit => habit.name)).toContain('Meditate')

    const updated = { ...result.current.data.habits[0], name: 'Read nightly' }
    await act(async () => {
      await result.current.saveHabit(updated)
    })

    expect(mocks.updateHabit).toHaveBeenCalledWith(updated, { userId: USER_ID })

    await act(async () => {
      await result.current.deleteHabit(updated.id)
    })

    expect(mocks.deleteHabit).toHaveBeenCalledWith(updated.id, { userId: USER_ID })
    expect(result.current.data.habits.some(habit => habit.id === updated.id)).toBe(false)
  })

  it('upserts and deletes entries and optional contexts', async () => {
    const { result } = renderHook(() => useSupabaseAppData(USER_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const entry = makeEntry({ id: 'entry-new', date: '2026-05-08', value: 'YES_MANUAL' })
    const context = makeContext({ id: 'context-new', entryId: entry.id })

    await act(async () => {
      await result.current.upsertEntry(entry)
      await result.current.upsertEntryContext(context)
    })

    expect(mocks.upsertEntry).toHaveBeenCalledWith(entry, { userId: USER_ID })
    expect(mocks.upsertEntryContext).toHaveBeenCalledWith(context, { userId: USER_ID })
    await waitFor(() => expect(result.current.data.entries.some(candidate => candidate.id === entry.id)).toBe(true))
    expect(result.current.data.entryContexts.some(candidate => candidate.id === context.id)).toBe(true)

    await act(async () => {
      await result.current.deleteEntry(entry.id)
      await result.current.deleteEntryContext(entry.id)
    })

    expect(mocks.deleteEntry).toHaveBeenCalledWith(entry.id, { userId: USER_ID })
    expect(mocks.deleteEntryContext).toHaveBeenCalledWith(entry.id, { userId: USER_ID })
    expect(result.current.data.entries.some(candidate => candidate.id === entry.id)).toBe(false)
  })

  it('imports ZIP data in replace and append modes without real Supabase credentials', async () => {
    const parsed: AppData = sampleAppData()
    const file = new File(['zip'], 'loop.zip', { type: 'application/zip' })
    const { result } = renderHook(() => useSupabaseAppData(USER_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.importData(file, true)
      await result.current.importData(file, false)
    })

    expect(mocks.parseImportZip).toHaveBeenCalledWith(file)
    expect(mocks.replaceAllUserDataFromImport).toHaveBeenCalledWith(parsed, 'loop.zip', { userId: USER_ID })
    expect(mocks.appendUserDataFromImport).toHaveBeenCalledWith(parsed, 'loop.zip', { userId: USER_ID })
  })

  it('refreshes and loads fresh export data', async () => {
    const { result } = renderHook(() => useSupabaseAppData(USER_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.refresh()
      await result.current.exportableDataForUser()
    })

    expect(mocks.fetchAppData).toHaveBeenCalledTimes(2)
    expect(mocks.exportableDataForUser).toHaveBeenCalledWith({ userId: USER_ID })
  })

  it('rolls back optimistic state and stores errors when persistence fails', async () => {
    const { result } = renderHook(() => useSupabaseAppData(USER_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))
    const originalHabitIds = result.current.data.habits.map(habit => habit.id)
    const newHabit = makeHabit({ id: 'habit-failing', position: '009', name: 'Failing habit' })

    mocks.createHabit.mockRejectedValueOnce(new Error('Create failed'))

    await act(async () => {
      await expect(result.current.saveHabit(newHabit)).rejects.toThrow('Create failed')
    })

    expect(result.current.error).toBe('Create failed')
    expect(result.current.data.habits.map(habit => habit.id)).toEqual(originalHabitIds)

    mocks.upsertEntry.mockRejectedValueOnce(new Error('Entry failed'))
    await act(async () => {
      await expect(result.current.upsertEntry(makeEntry({ id: 'entry-failing', date: '2026-05-08' }))).rejects.toThrow('Entry failed')
    })

    expect(result.current.error).toBe('Entry failed')
    expect(result.current.data.entries.some(entry => entry.id === 'entry-failing')).toBe(false)
  })

  it('stores load, import and export errors from async operations', async () => {
    mocks.fetchAppData.mockRejectedValueOnce(new Error('Initial load failed'))
    const { result } = renderHook(() => useSupabaseAppData(USER_ID))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Initial load failed')

    mocks.fetchAppData.mockRejectedValueOnce(new Error('Refresh failed'))
    await act(async () => {
      await expect(result.current.refresh()).rejects.toThrow('Refresh failed')
    })
    expect(result.current.error).toBe('Refresh failed')

    mocks.parseImportZip.mockRejectedValueOnce(new Error('Import failed'))
    await act(async () => {
      await expect(result.current.importData(new File(['zip'], 'bad.zip'), true)).rejects.toThrow('Import failed')
    })
    expect(result.current.error).toBe('Import failed')

    mocks.exportableDataForUser.mockRejectedValueOnce(new Error('Export failed'))
    await act(async () => {
      await expect(result.current.exportableDataForUser()).rejects.toThrow('Export failed')
    })
    expect(result.current.error).toBe('Export failed')
  })

  it('clears data and rejects mutations when there is no signed-in user', async () => {
    const { result } = renderHook(() => useSupabaseAppData(null))

    await act(async () => {
      await expect(result.current.refresh()).resolves.toEqual({ habits: [], entries: [], entryContexts: [] })
      await expect(result.current.saveHabit(makeHabit())).rejects.toThrow('Sign in')
      await expect(result.current.deleteHabit('habit-read')).rejects.toThrow('Sign in')
      await expect(result.current.upsertEntry(makeEntry())).rejects.toThrow('Sign in')
      await expect(result.current.deleteEntry('entry-1')).rejects.toThrow('Sign in')
      await expect(result.current.importData(new File(['zip'], 'loop.zip'), true)).rejects.toThrow('Sign in')
      await expect(result.current.exportableDataForUser()).rejects.toThrow('Sign in')
      await expect(result.current.upsertEntryContext(makeContext())).rejects.toThrow('Sign in')
      await expect(result.current.deleteEntryContext('entry-1')).rejects.toThrow('Sign in')
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toEqual({ habits: [], entries: [], entryContexts: [] })
  })
})
