import { useEffect, useMemo, useRef, useState } from 'react'
import type { AppData, Habit } from './types'
import { HabitDetail } from './components/HabitDetail'
import { HabitForm } from './components/HabitForm'
import { HabitList } from './components/HabitList'
import { clearData, loadData, saveData } from './lib/storage'
import { defaultHabit, normalizeHabit, referenceDateForData } from './lib/calculations'
import { exportDebugSummary, exportLoopZip, importLoopZip } from './lib/csv'
import { todayISO } from './lib/date'

const emptyData: AppData = { habits: [], entries: [] }

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData() ?? emptyData)
  const [selectedId, setSelectedId] = useState<string | null>(() => loadData()?.habits[0]?.id ?? null)
  const [replaceImport, setReplaceImport] = useState(true)
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportSelection, setExportSelection] = useState<Set<string>>(new Set())
  const [includeAllMetadata, setIncludeAllMetadata] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => saveData(data), [data])

  const visibleHabits = useMemo(() => data.habits.filter(h => !h.archived), [data.habits])
  const selectedHabit = useMemo(() => {
    if (!data.habits.length) return null
    return data.habits.find(h => h.id === selectedId) ?? visibleHabits[0] ?? data.habits[0]
  }, [data.habits, selectedId, visibleHabits])

  useEffect(() => {
    if (!selectedId && selectedHabit) setSelectedId(selectedHabit.id)
  }, [selectedHabit, selectedId])

  async function handleImport(file: File) {
    try {
      const next = await importLoopZip(file, replaceImport, data)
      setData(next)
      const firstWithEntries = next.habits.find(h => next.entries.some(e => e.habitId === h.id))
      setSelectedId((firstWithEntries ?? next.habits[0])?.id ?? null)
      alert(`Import complete.\n\n${next.habits.length} habits.\n${next.entries.length} entries.\n\n${exportDebugSummary(next)}`)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not import the ZIP')
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
      alert('Select at least one habit to export.')
      return
    }
    const blob = await exportLoopZip(data, exportSelection, includeAllMetadata)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `open-habits-export-${todayISO()}.zip`
    a.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
  }

  function saveHabit(habit: Habit) {
    const normalized = normalizeHabit(habit)
    setData(prev => {
      const exists = prev.habits.some(h => h.id === normalized.id)
      return {
        ...prev,
        habits: exists
          ? prev.habits.map(h => h.id === normalized.id ? normalized : h)
          : [...prev.habits, normalized].sort((a, b) => a.position.localeCompare(b.position))
      }
    })
    setSelectedId(normalized.id)
    setEditingHabit(null)
  }

  function deleteHabit(habitId: string) {
    if (!confirm('Delete this habit and all of its entries?')) return
    setData(prev => ({
      habits: prev.habits.filter(h => h.id !== habitId),
      entries: prev.entries.filter(e => e.habitId !== habitId)
    }))
    setSelectedId(null)
    setEditingHabit(null)
  }

  const reference = referenceDateForData(data)

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
          <button type="button" onClick={() => fileRef.current?.click()}>Import ZIP</button>
          <input ref={fileRef} hidden type="file" accept=".zip" onChange={e => {
            const file = e.currentTarget.files?.[0]
            if (file) void handleImport(file)
          }} />
          <button type="button" onClick={openExportModal} disabled={!data.habits.length}>Export</button>
          <button type="button" onClick={() => setEditingHabit(defaultHabit(data.habits.length + 1))}>New</button>
          <button type="button" className="danger" onClick={() => {
            if (confirm('Delete all local data?')) {
              clearData()
              setData(emptyData)
              setSelectedId(null)
            }
          }}>Reset</button>
        </div>
      </header>

      <div className="appLayout">
        <HabitList
          habits={visibleHabits}
          entries={data.entries}
          selectedId={selectedHabit?.id ?? null}
          onSelect={setSelectedId}
          onEntriesChange={entries => setData(prev => ({ ...prev, entries }))}
        />

        {selectedHabit ? (
          <HabitDetail
            habit={selectedHabit}
            entries={data.entries}
            onEntriesChange={entries => setData(prev => ({ ...prev, entries }))}
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
      </div>

      {editingHabit && (
        <HabitForm
          habit={editingHabit}
          onCancel={() => setEditingHabit(null)}
          onSave={saveHabit}
          onDelete={data.habits.some(h => h.id === editingHabit.id) ? deleteHabit : undefined}
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
