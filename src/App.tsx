import { useEffect, useMemo, useRef, useState } from 'react'
import { AppData, Habit } from './types'
import { HabitList } from './components/HabitList'
import { HabitDetail } from './components/HabitDetail'
import { clearData, loadData, saveData } from './lib/storage'
import { exportLoopZip, importLoopZip } from './lib/csv'
import { todayISO } from './lib/date'
import { upsertEntry } from './lib/calculations'

const emptyData: AppData = { habits: [], entries: [] }

function demoData(): AppData {
  const habit: Habit = {
    id: crypto.randomUUID(),
    position: '001',
    name: 'No PMO',
    type: 'NUMERICAL',
    question: 'PMO hoy?',
    description: '',
    frequencyNumerator: 1,
    frequencyDenominator: 1,
    color: '#8E24AA',
    unit: '',
    targetType: 'AT_MOST',
    targetValue: 0,
    archived: false
  }
  return { habits: [habit], entries: [] }
}

export default function App() {
  const [data, setData] = useState<AppData>(() => loadData() ?? demoData())
  const [selectedId, setSelectedId] = useState<string | null>(() => data.habits[0]?.id ?? null)
  const [replaceImport, setReplaceImport] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => saveData(data), [data])

  const selected = useMemo(() => data.habits.find(h => h.id === selectedId) ?? data.habits[0], [data.habits, selectedId])

  async function onImport(file: File) {
    try {
      const next = await importLoopZip(file, replaceImport, data)
      setData(next)
      setSelectedId(next.habits[0]?.id ?? null)
      alert(`Importación correcta: ${next.habits.length} hábitos y ${next.entries.length} registros.`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error importando ZIP')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function onExport() {
    const ids = new Set(data.habits.map(h => h.id))
    const blob = await exportLoopZip(data, ids)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `open-habits-export-${todayISO()}.zip`
    a.click()
    URL.revokeObjectURL(url)
  }

  function register(habit: Habit, date: string, value: string) {
    setData(prev => ({ ...prev, entries: upsertEntry(prev.entries, habit, date, value) }))
  }

  return (
    <main className="appShell">
      <header className="topbar">
        <div>
          <h1>Open Habits</h1>
          <p>Replica web responsive de Loop Habit Tracker con import/export ZIP.</p>
        </div>
        <div className="actions">
          <label className="check">
            <input type="checkbox" checked={replaceImport} onChange={e => setReplaceImport(e.target.checked)} />
            Reemplazar al importar
          </label>
          <button onClick={() => fileRef.current?.click()}>Importar ZIP</button>
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            hidden
            onChange={e => {
              const file = e.currentTarget.files?.[0]
              if (file) void onImport(file)
            }}
          />
          <button onClick={onExport} disabled={!data.habits.length}>Exportar ZIP</button>
          <button className="danger" onClick={() => {
            if (confirm('¿Borrar datos locales?')) {
              clearData()
              setData(emptyData)
              setSelectedId(null)
            }
          }}>Reset</button>
        </div>
      </header>

      <div className="layout">
        <HabitList habits={data.habits} entries={data.entries} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
        {selected ? (
          <HabitDetail habit={selected} entries={data.entries} onRegister={(date, value) => register(selected, date, value)} />
        ) : (
          <section className="panel empty">
            <h2>No hay hábitos todavía</h2>
            <p>Importa el ZIP de Loop Habit Tracker para rellenar la aplicación.</p>
          </section>
        )}
      </div>
    </main>
  )
}
