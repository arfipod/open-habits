import { Habit, HabitEntry } from '../types'
import { bestStreaks, displayValue, entryMap, historyByMonth, isSuccess, latestScore, periodTotal, scoreSeries, weekdayFrequency } from '../lib/calculations'
import { addDays, formatShort, lastNDays, monthLabel, todayISO } from '../lib/date'

interface Props {
  habit: Habit
  entries: HabitEntry[]
  onRegister: (date: string, value: string) => void
}

export function HabitDetail({ habit, entries, onRegister }: Props) {
  const scores = scoreSeries(habit, entries).slice(-12)
  const history = historyByMonth(habit, entries).slice(-12)
  const streaks = bestStreaks(habit, entries)
  const freq = weekdayFrequency(habit, entries)
  const map = entryMap(entries, habit.id)
  const calendarDays = lastNDays(98)

  return (
    <section className="detail">
      <div className="detailHeader">
        <div>
          <h2>{habit.name}</h2>
          <p>{habit.question || 'Sin pregunta configurada'}</p>
        </div>
        <div className="scoreBadge" style={{ background: habit.color }}>{Math.round(latestScore(habit, entries) * 100)}%</div>
      </div>

      <div className="quickRegister">
        <input
          type={habit.type === 'NUMERICAL' ? 'number' : 'hidden'}
          id="quickValue"
          placeholder={habit.type === 'NUMERICAL' ? 'Valor de hoy' : ''}
          defaultValue={habit.type === 'NUMERICAL' ? '0' : 'yes'}
        />
        {habit.type === 'YES_NO' ? (
          <>
            <button onClick={() => onRegister(todayISO(), 'yes')}>✓ Hecho hoy</button>
            <button className="secondary" onClick={() => onRegister(todayISO(), 'no')}>× Fallo hoy</button>
          </>
        ) : (
          <button onClick={() => {
            const el = document.getElementById('quickValue') as HTMLInputElement
            onRegister(todayISO(), el.value || '0')
          }}>Registrar hoy</button>
        )}
      </div>

      <div className="cards">
        <Metric title="Today" value={periodTotal(habit, entries, 'today')} />
        <Metric title="Week" value={periodTotal(habit, entries, 'week')} />
        <Metric title="Month" value={periodTotal(habit, entries, 'month')} />
        <Metric title="Quarter" value={periodTotal(habit, entries, 'quarter')} />
        <Metric title="Year" value={periodTotal(habit, entries, 'year')} />
      </div>

      <Block title="Score">
        <div className="lineChart">
          {scores.map(p => <span key={p.date} title={`${p.date}: ${Math.round(p.score * 100)}%`} style={{ height: `${Math.max(4, p.score * 100)}%`, background: habit.color }} />)}
        </div>
      </Block>

      <Block title="History by month">
        <div className="barChart">
          {history.map(p => (
            <div key={p.key} className="barItem">
              <span className="bar" style={{ height: `${Math.max(4, Math.min(100, p.value * 12))}%`, background: habit.color }}>{p.value || ''}</span>
              <small>{monthLabel(p.key)}</small>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Calendar">
        <div className="calendarGrid">
          {calendarDays.map(date => {
            const e = map.get(date)
            const ok = isSuccess(habit, e?.value)
            return (
              <button
                key={date}
                className={`calDay ${ok ? 'ok' : e ? 'bad' : ''}`}
                style={{ background: ok ? habit.color : undefined }}
                title={`${date}: ${displayValue(habit, e?.value) || 'sin dato'}`}
                onClick={() => {
                  const v = prompt(`Valor para ${date}`, habit.type === 'NUMERICAL' ? '0' : 'yes')
                  if (v !== null) onRegister(date, v)
                }}
              >
                {new Date(`${date}T12:00:00`).getDate()}
              </button>
            )
          })}
        </div>
      </Block>

      <Block title="Best streaks">
        <div className="streaks">
          {streaks.length === 0 && <p className="muted">Sin rachas todavía.</p>}
          {streaks.map(s => (
            <div className="streak" key={`${s.start}-${s.end}`}>
              <span>{formatShort(s.start)} → {formatShort(s.end)}</span>
              <strong>{s.days}</strong>
            </div>
          ))}
        </div>
      </Block>

      <Block title="Frequency">
        <div className="weekdayGrid">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => (
            <div key={d}>
              <span>{d}</span>
              <b style={{ background: habit.color, width: `${Math.max(10, Math.min(100, freq[i] * 8))}%` }}>{freq[i]}</b>
            </div>
          ))}
        </div>
      </Block>
    </section>
  )
}

function Metric({ title, value }: { title: string, value: number }) {
  return <div className="metric"><span>{title}</span><strong>{Number.isInteger(value) ? value : value.toFixed(1)}</strong></div>
}

function Block({ title, children }: { title: string, children: React.ReactNode }) {
  return <section className="block"><h3>{title}</h3>{children}</section>
}
