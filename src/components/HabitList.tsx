import type { CSSProperties } from 'react'
import type { Habit, HabitEntry } from '../types'
import { cropText, displayValue, entryMap, latestScore, referenceDateForData, successForDisplay, toggleEntry } from '../lib/calculations'
import { addDays, formatShort } from '../lib/date'

interface Props {
  habits: Habit[]
  entries: HabitEntry[]
  selectedId: string | null
  onSelect: (habitId: string) => void
  onEntriesChange: (entries: HabitEntry[]) => void
}

export function HabitList({ habits, entries, selectedId, onSelect, onEntriesChange }: Props) {
  const reference = referenceDateForData({ habits, entries })
  const dates = Array.from({ length: 5 }, (_, i) => addDays(reference, -i))

  return (
    <section className="habitListCard">
      <div className="habitListDates">
        <div />
        {dates.map(date => <span key={date}>{formatShort(date)}</span>)}
      </div>

      {habits.map(habit => {
        const map = entryMap(entries, habit.id)
        const score = latestScore(habit, entries, reference)
        const ringStyle = {
          '--habit-color': habit.color,
          '--habit-progress': `${Math.round(score * 100)}%`
        } as CSSProperties

        return (
          <button
            key={habit.id}
            className={`habitRow ${selectedId === habit.id ? 'selected' : ''} ${habit.archived ? 'archived' : ''}`}
            onClick={() => onSelect(habit.id)}
          >
            <span className="habitRowName">
              <span className="habitRing" style={ringStyle} />
              <span>{cropText(habit.name, 34)}</span>
            </span>

            {dates.map(date => {
              const entry = map.get(date)
              const ok = successForDisplay(habit, entry?.value)
              return (
                <span
                  key={date}
                  className={`habitDayValue ${ok ? 'ok' : entry ? 'bad' : 'empty'}`}
                  style={{ color: ok ? habit.color : undefined }}
                  onClick={event => {
                    event.stopPropagation()
                    onEntriesChange(toggleEntry(entries, habit, date))
                  }}
                  title={`${date}: ${displayValue(habit, entry?.value) || 'no data'}`}
                >
                  {displayValue(habit, entry?.value)}
                </span>
              )
            })}
          </button>
        )
      })}
    </section>
  )
}
