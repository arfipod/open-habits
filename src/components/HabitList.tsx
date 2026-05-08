import { Habit, HabitEntry } from '../types'
import { displayValue, isSuccess, latestScore, recentDates } from '../lib/calculations'
import { formatShort } from '../lib/date'

interface Props {
  habits: Habit[]
  entries: HabitEntry[]
  selectedId: string | null
  onSelect: (habitId: string) => void
}

export function HabitList({ habits, entries, selectedId, onSelect }: Props) {
  const dates = recentDates()
  return (
    <section className="panel listPanel">
      <div className="dateHeader">
        <div></div>
        {dates.map(d => <div key={d}>{formatShort(d)}</div>)}
      </div>

      {habits.map(habit => {
        const score = latestScore(habit, entries)
        return (
          <button
            key={habit.id}
            className={`habitRow ${selectedId === habit.id ? 'selected' : ''}`}
            onClick={() => onSelect(habit.id)}
          >
            <div className="habitName">
              <span className="ring" style={{ '--c': habit.color, '--p': `${Math.round(score * 100)}%` } as React.CSSProperties}></span>
              <span>{habit.name}</span>
            </div>
            {dates.map(date => {
              const entry = entries.find(e => e.habitId === habit.id && e.date === date)
              const ok = isSuccess(habit, entry?.value)
              return <span key={date} className={`dayValue ${ok ? 'ok' : 'bad'}`} style={{ color: ok ? habit.color : undefined }}>{displayValue(habit, entry?.value)}</span>
            })}
          </button>
        )
      })}
    </section>
  )
}
