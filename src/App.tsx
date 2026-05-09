import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Habit, HabitEntry } from './types'
import { AuthGate } from './components/AuthGate'
import { HabitDetail } from './components/HabitDetail'
import { HabitForm } from './components/HabitForm'
import { HabitList } from './components/HabitList'
import { UserMenu } from './components/UserMenu'
import { defaultHabit, normalizeHabit, referenceDateForData } from './lib/calculations'
import { exportLoopZip } from './lib/csv'
import { todayISO } from './lib/date'
import { loadSelectedHabitId, saveSelectedHabitId } from './lib/storage'
import { useSupabaseAppData } from './hooks/useSupabaseAppData'

interface Notice {
  kind: 'success' | 'error'
  text: string
}

export default function App() {
  return (
    <AuthGate>
      {session => <HabitsApp session={session} />}
    </AuthGate>
  )
}

function HabitsApp({ session }: { session: Session }) {
  const {
    data,
    loading,
    error,
    refresh,
    saveHabit: persistHabit,
    deleteHabit: deleteHabitFromSupabase,
    upsertEntry: persistEntry,
    deleteEntry: deleteEntryFromSupabase,
    importData,
    exportableDataForUser,
    clearError
  } = useSupabaseAppData(session.user.id)
  const [selectedId, setSelectedIdState] = useState<string | null>(() => loadSelectedHabitId())
  const [replaceImport, setReplaceImport] = useState(true)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportSelection, setExportSelection] = useState<Set<string>>(new Set())
  const [includeAllMetadata, setIncludeAllMetadata] = useState(true)
  const [notice, setNotice] = useState<Notice | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const setSelectedId = useCallback((habitId: string | null) => {
    setSelectedIdState(habitId)
    saveSelectedHabitId(habitId)
  }, [])

  const visibleHabits = useMemo(() => data.habits.filter(h => !h.archived), [data.habits])
  const selectedHabit = useMemo(() => {
    if (!data.habits.length) return null
    return data.habits.find(h => h.id === selectedId) ?? visibleHabits[0] ?? data.habits[0]
  }, [data.habits, selectedId, visibleHabits])

  useEffect(() => {
    if (selectedHabit && selectedHabit.id !== selectedId) setSelectedId(selectedHabit.id)
    if (!selectedHabit && selectedId) setSelectedId(null)
  }, [selectedHabit, selectedId, setSelectedId])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 5200)
    return () => window.clearTimeout(timer)
  }, [notice])

  function notify(kind: Notice['kind'], text: string) {
    setNotice({ kind, text })
  }

  async function handleImport(file: File) {
    try {
      const next = await importData(file, replaceImport)
      const firstWithEntries = next.habits.find(h => next.entries.some(e => e.habitId === h.id))
      setSelectedId((firstWithEntries ?? next.habits[0])?.id ?? null)
      notify('success', `Imported ${next.habits.length} habits and ${next.entries.length} entries.`)
    } catch (importError) {
      notify('error', errorMessage(importError, 'Could not import the ZIP.'))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function openExportModal() {
    setExportSelection(new Set(data.habits.map(h => h.id)))
    setExportOpen(true)
  }

  async function handleExport() {
    if (exportSelection.size === 0) {
      notify('error', 'Select at least one habit to export.')
      return
    }

    try {
      const freshData = await exportableDataForUser()
      const freshHabitIds = new Set(freshData.habits.map(habit => habit.id))
      const selected = new Set([...exportSelection].filter(habitId => freshHabitIds.has(habitId)))
      if (selected.size === 0) {
        notify('error', 'Selected habits are no longer available.')
        return
      }

      const blob = await exportLoopZip(freshData, selected, includeAllMetadata)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `open-habits-export-${todayISO()}.zip`
      a.click()
      URL.revokeObjectURL(url)
      setExportOpen(false)
      notify('success', 'Export ZIP created from fresh Supabase data.')
    } catch (exportError) {
      notify('error', errorMessage(exportError, 'Could not export habits.'))
    }
  }

  async function saveHabit(habit: Habit) {
    const normalized = normalizeHabit(habit)
    try {
      const saved = await persistHabit(normalized)
      setSelectedId(saved.id)
      setEditingHabit(null)
      notify('success', 'Habit saved.')
    } catch (saveError) {
      notify('error', errorMessage(saveError, 'Could not save habit.'))
    }
  }

  async function deleteHabit(habitId: string) {
    if (!confirm('Delete this habit and all of its entries?')) return

    try {
      await deleteHabitFromSupabase(habitId)
      setSelectedId(null)
      setEditingHabit(null)
      notify('success', 'Habit deleted.')
    } catch (deleteError) {
      notify('error', errorMessage(deleteError, 'Could not delete habit.'))
    }
  }

  async function saveEntries(nextEntries: HabitEntry[]) {
    const previousEntries = data.entries
    const previousById = new Map(previousEntries.map(entry => [entry.id, entry]))
    const nextById = new Map(nextEntries.map(entry => [entry.id, entry]))
    const changed = nextEntries.filter(entry => {
      const previous = previousById.get(entry.id)
      return !previous || !sameEntry(previous, entry)
    })
    const removed = previousEntries.filter(entry => !nextById.has(entry.id))

    try {
      for (const entry of changed) {
        await persistEntry(entry)
      }
      for (const entry of removed) {
        await deleteEntryFromSupabase(entry.id)
      }
    } catch (entryError) {
      notify('error', errorMessage(entryError, 'Could not save entry.'))
    }
  }

  async function handleRefresh() {
    try {
      await refresh()
      notify('success', 'Habits refreshed.')
    } catch (refreshError) {
      notify('error', errorMessage(refreshError, 'Could not refresh habits.'))
    }
  }

  const reference = referenceDateForData(data)
  const blockingLoad = loading && data.habits.length === 0 && data.entries.length === 0
  const blockingError = Boolean(error && !loading && data.habits.length === 0 && data.entries.length === 0)

  return (
    <main className="appShell">
      <header className="appHeader">
        <div className="appTitle">
          <h1>Open Habits</h1>
          <p>Import, calculate, and export habits in the style of Loop Habit Tracker. Reference date: {reference}</p>
        </div>

        <div className="headerActions">
          <label className="inlineCheck light">
            <input type="checkbox" checked={replaceImport} onChange={e => setReplaceImport(e.target.checked)} />
            Replace on import
          </label>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={loading}>Import ZIP</button>
          <input ref={fileRef} hidden type="file" accept=".zip" onChange={e => {
            const file = e.currentTarget.files?.[0]
            if (file) void handleImport(file)
          }} />
          <button type="button" onClick={openExportModal} disabled={!data.habits.length || loading}>Export</button>
          <button type="button" onClick={() => setEditingHabit(defaultHabit(data.habits.length + 1))} disabled={loading}>New</button>
          <button type="button" className="secondary" onClick={() => void handleRefresh()} disabled={loading}>Refresh</button>
          <UserMenu email={session.user.email} />
        </div>
      </header>

      {(notice || error) && (
        <div
          className={`toast ${notice?.kind === 'error' || (!notice && error) ? 'error' : ''}`}
          role={notice?.kind === 'error' || (!notice && error) ? 'alert' : 'status'}
        >
          <span>{notice?.text ?? error}</span>
          <button type="button" className="ghost" onClick={() => { setNotice(null); clearError() }}>×</button>
        </div>
      )}

      <div className="appLayout">
        {blockingLoad ? (
          <section className="emptyState">
            <h2>Loading habits</h2>
            <p>Reading your Supabase habits and entries.</p>
          </section>
        ) : blockingError ? (
          <section className="emptyState">
            <h2>Error loading data</h2>
            <p>{error}</p>
            <div>
              <button type="button" onClick={() => void handleRefresh()}>Retry</button>
            </div>
          </section>
        ) : (
          <>
            <HabitList
              habits={visibleHabits}
              entries={data.entries}
              selectedId={selectedHabit?.id ?? null}
              onSelect={setSelectedId}
              onEntriesChange={entries => void saveEntries(entries)}
            />

            {selectedHabit ? (
              <HabitDetail
                habit={selectedHabit}
                entries={data.entries}
                onEntriesChange={entries => void saveEntries(entries)}
                onEdit={() => setEditingHabit(selectedHabit)}
              />
            ) : (
              <section className="emptyState">
                <h2>No habits loaded</h2>
                <p>Import your Android Habits / Loop Habit Tracker ZIP or create a new habit.</p>
                <div>
                  <button type="button" onClick={() => fileRef.current?.click()}>Import ZIP</button>
                  <button type="button" className="secondary" onClick={() => setEditingHabit(defaultHabit(1))}>Create habit</button>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {editingHabit && (
        <HabitForm
          habit={editingHabit}
          onCancel={() => setEditingHabit(null)}
          onSave={habit => void saveHabit(habit)}
          onDelete={data.habits.some(h => h.id === editingHabit.id) ? habitId => void deleteHabit(habitId) : undefined}
        />
      )}

      {exportOpen && (
        <div className="modalBackdrop" role="dialog" aria-modal="true">
          <section className="exportModal">
            <header className="modalHeader">
              <h2>Export habits</h2>
              <button type="button" className="ghost" onClick={() => setExportOpen(false)}>×</button>
            </header>

            <label className="inlineCheck">
              <input type="checkbox" checked={includeAllMetadata} onChange={e => setIncludeAllMetadata(e.target.checked)} />
              Include all habits in Habits.csv, even when only selected entries are exported
            </label>

            <div className="exportList">
              {data.habits.map(habit => (
                <label key={habit.id} className="exportItem">
                  <input
                    type="checkbox"
                    checked={exportSelection.has(habit.id)}
                    onChange={e => {
                      setExportSelection(prev => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(habit.id)
                        else next.delete(habit.id)
                        return next
                      })
                    }}
                  />
                  <span className="colorDot" style={{ background: habit.color }} />
                  <span>{habit.position} · {habit.name}</span>
                </label>
              ))}
            </div>

            <footer className="modalActions">
              <button type="button" className="secondary" onClick={() => setExportSelection(new Set(data.habits.map(h => h.id)))}>All</button>
              <button type="button" className="secondary" onClick={() => setExportSelection(new Set(selectedHabit ? [selectedHabit.id] : []))}>Current only</button>
              <span />
              <button type="button" className="secondary" onClick={() => setExportOpen(false)}>Cancel</button>
              <button type="button" onClick={() => void handleExport()}>Export ZIP</button>
            </footer>
          </section>
        </div>
      )}
    </main>
  )
}

function sameEntry(a: HabitEntry, b: HabitEntry): boolean {
  return a.habitId === b.habitId &&
    a.date === b.date &&
    a.value === b.value &&
    a.notes === b.notes &&
    a.createdAt === b.createdAt &&
    a.updatedAt === b.updatedAt
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}
