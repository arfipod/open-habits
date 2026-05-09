import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { EntryValue, Habit, HabitEntry, HabitEntryContext, PeriodKind, ScorePoint } from '../types'
import {
  bestStreaks,
  calendarMatrix,
  createId,
  displayValue,
  entryMap,
  formatNumber,
  historyPoints,
  latestScore,
  monthMarkers,
  periodTotal,
  referenceDateForHabit,
  scoreChartPoints,
  successForDisplay,
  toggleEntry,
  upsertEntry,
  nowISO,
  weekdayFrequency
} from '../lib/calculations'
import { addDays, formatLong, formatShort, monthLabel, shortMonth, todayISO } from '../lib/date'

interface Props {
  habit: Habit
  entries: HabitEntry[]
  entryContexts: HabitEntryContext[]
  onEntriesChange: (entries: HabitEntry[]) => void
  onSaveEntryWithContext: (entry: HabitEntry, context: HabitEntryContext | null) => void
  onEdit: () => void
}

export function HabitDetail({ habit, entries, entryContexts, onEntriesChange, onSaveEntryWithContext, onEdit }: Props) {
  const referenceDate = referenceDateForHabit(habit, entries)
  const [quickDate, setQuickDate] = useState(todayISO())
  const [quickValue, setQuickValue] = useState(habit.type === 'NUMERICAL' ? '0' : 'yes')
  const [quickNotes, setQuickNotes] = useState('')
  const [contextOpen, setContextOpen] = useState(false)
  const [occurredTime, setOccurredTime] = useState('')
  const [locationText, setLocationText] = useState('')
  const [comment, setComment] = useState('')
  const [scorePeriod, setScorePeriod] = useState<PeriodKind>('week')
  const [scoreOffset, setScoreOffset] = useState(0)
  const [historyPeriod, setHistoryPeriod] = useState<PeriodKind>('month')
  const [historyOffset, setHistoryOffset] = useState(0)
  const [calendarOffset, setCalendarOffset] = useState(0)

  const score = latestScore(habit, entries, referenceDate)
  const selectedEntry = entries.find(entry => entry.habitId === habit.id && entry.date === quickDate)
  const selectedContext = selectedEntry ? entryContexts.find(context => context.entryId === selectedEntry.id) : undefined
  const placeLabel = habit.targetType === 'AT_MOST' ? 'Where did it happen?' : 'Where did you do it?'

  useEffect(() => {
    const entry = entries.find(candidate => candidate.habitId === habit.id && candidate.date === quickDate)
    const context = entry ? entryContexts.find(candidate => candidate.entryId === entry.id) : undefined
    setQuickValue(entry ? entryValueToInput(entry.value, habit) : habit.type === 'NUMERICAL' ? '0' : 'yes')
    setQuickNotes(entry?.notes ?? '')
    setOccurredTime((context?.occurredTime ?? '').slice(0, 5))
    setLocationText(context?.locationText ?? '')
    setComment(context?.comment ?? '')
    setContextOpen(Boolean(context))
  }, [habit, entries, entryContexts, quickDate])

  function saveQuickEntry() {
    const nextEntries = upsertEntry(entries, habit, quickDate, quickValue, quickNotes)
    const entry = nextEntries.find(candidate => candidate.habitId === habit.id && candidate.date === quickDate)
    if (!entry) return

    const hasContext = Boolean(occurredTime || locationText.trim() || comment.trim())
    const timestamp = nowISO()
    const nextContext = hasContext
      ? {
          id: selectedContext?.id ?? createId(),
          habitId: habit.id,
          entryId: entry.id,
          occurredAt: occurredTime ? `${quickDate}T${occurredTime}:00` : null,
          occurredTime: occurredTime || null,
          locationText: locationText.trim(),
          comment: comment.trim(),
          createdAt: selectedContext?.createdAt ?? timestamp,
          updatedAt: timestamp
        }
      : null

    onSaveEntryWithContext(entry, nextContext)
  }

  return (
    <section className="detailPanel">
      <header className="habitToolbar" style={{ '--habit-color': habit.color } as CSSProperties}>
        <button className="backGhost" type="button" title="Back">‹</button>
        <div>
          <h2>{habit.name}</h2>
          <p>{habit.question || 'No question'}</p>
        </div>
        <button type="button" className="iconButton" onClick={onEdit} title="Edit">✎</button>
      </header>

      <section className="habitSummary">
        <h3>{habit.question || habit.name}</h3>
        <div className="habitMeta">
          <span>⬇ {habit.type === 'NUMERICAL' ? formatNumber(habit.targetValue ?? 0) : '✓'}</span>
          <span>▦ {frequencyLabel(habit)}</span>
          <span>🔔 Off</span>
          <span className="scorePill" style={{ background: habit.color }}>{Math.round(score * 100)}%</span>
        </div>
      </section>

      <section className="quickPanel">
        <strong>Log</strong>
        <input type="date" value={quickDate} onChange={e => setQuickDate(e.target.value)} aria-label="Entry date" />
        {habit.type === 'NUMERICAL' ? (
          <input
            type="number"
            step="0.01"
            value={quickValue}
            onChange={e => setQuickValue(e.target.value)}
            aria-label="Numerical value"
          />
        ) : (
          <select value={quickValue} onChange={e => setQuickValue(e.target.value)}>
            <option value="yes">Done</option>
            <option value="no">Not done</option>
            <option value="skip">Skipped</option>
            <option value="unknown">Unknown</option>
          </select>
        )}
        <input
          type="text"
          value={quickNotes}
          onChange={e => setQuickNotes(e.target.value)}
          placeholder="Loop-compatible notes"
          aria-label="Notes"
        />
        <button type="button" onClick={saveQuickEntry}>{selectedEntry ? 'Update entry' : 'Save entry'}</button>
        <details className="contextEditor" open={contextOpen} onToggle={event => setContextOpen(event.currentTarget.open)}>
          <summary>Optional context</summary>
          <div className="contextFields">
            <label>
              At what time?
              <input type="time" value={occurredTime} onChange={e => setOccurredTime(e.target.value)} />
            </label>
            <label>
              {placeLabel}
              <input
                type="text"
                value={locationText}
                onChange={e => setLocationText(e.target.value)}
                placeholder="Home, office, gym…"
              />
            </label>
            <label>
              Comment
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} />
            </label>
          </div>
        </details>
      </section>

      <TargetSection habit={habit} entries={entries} referenceDate={referenceDate} />

      <ChartBlock
        title="Score"
        period={scorePeriod}
        onPeriodChange={p => { setScorePeriod(p); setScoreOffset(0) }}
        offset={scoreOffset}
        onOlder={() => setScoreOffset(v => v + 1)}
        onNewer={() => setScoreOffset(v => Math.max(0, v - 1))}
      >
        <ScoreChart habit={habit} entries={entries} period={scorePeriod} offset={scoreOffset} referenceDate={referenceDate} />
      </ChartBlock>

      <ChartBlock
        title="History"
        period={historyPeriod}
        onPeriodChange={p => { setHistoryPeriod(p); setHistoryOffset(0) }}
        offset={historyOffset}
        onOlder={() => setHistoryOffset(v => v + 1)}
        onNewer={() => setHistoryOffset(v => Math.max(0, v - 1))}
      >
        <HistoryChart habit={habit} entries={entries} period={historyPeriod} offset={historyOffset} referenceDate={referenceDate} />
      </ChartBlock>

      <section className="chartBlock">
        <header className="sectionHeader">
          <h3>Calendar</h3>
          <div className="navButtons">
            <button type="button" className="smallGhost" onClick={() => setCalendarOffset(v => v + 4)}>‹</button>
            <button type="button" className="smallGhost" onClick={() => setCalendarOffset(v => Math.max(0, v - 4))} disabled={calendarOffset === 0}>›</button>
          </div>
        </header>
        <CalendarGrid
          habit={habit}
          entries={entries}
          referenceDate={referenceDate}
          offsetWeeks={calendarOffset}
          onEntriesChange={onEntriesChange}
        />
      </section>

      <section className="chartBlock">
        <header className="sectionHeader"><h3>Best streaks</h3></header>
        <BestStreaks habit={habit} entries={entries} referenceDate={referenceDate} />
      </section>

      <section className="chartBlock">
        <header className="sectionHeader"><h3>Frequency</h3></header>
        <FrequencyChart habit={habit} entries={entries} />
      </section>
    </section>
  )
}

function frequencyLabel(habit: Habit): string {
  const times = Math.max(1, Math.round(habit.frequencyNumerator || 1))
  const days = Math.max(1, Math.round(habit.frequencyDenominator || 1))
  if (times === days) return 'At least once per day'
  if (days % 30 === 0) {
    const months = days / 30
    return `At least ${times} time${times === 1 ? '' : 's'} every ${months} month${months === 1 ? '' : 's'}`
  }
  if (days % 7 === 0) {
    const weeks = days / 7
    return `At least ${times} time${times === 1 ? '' : 's'} every ${weeks} week${weeks === 1 ? '' : 's'}`
  }
  return `At least ${times} time${times === 1 ? '' : 's'} every ${days} day${days === 1 ? '' : 's'}`
}

function entryValueToInput(value: EntryValue, habit: Habit): string {
  if (habit.type === 'NUMERICAL') return typeof value === 'number' ? String(value / 1000) : '0'
  if (value === 'NO') return 'no'
  if (value === 'SKIP') return 'skip'
  if (value === 'UNKNOWN') return 'unknown'
  return 'yes'
}

function TargetSection({ habit, entries, referenceDate }: { habit: Habit, entries: HabitEntry[], referenceDate: string }) {
  const rows: Array<[string, 'today' | 'week' | 'month' | 'quarter' | 'year']> = [
    ['Today', 'today'], ['Week', 'week'], ['Month', 'month'], ['Quarter', 'quarter'], ['Year', 'year']
  ]
  const values = rows.map(([label, key]) => ({ label, value: periodTotal(habit, entries, key, referenceDate) }))
  const max = Math.max(1, ...values.map(v => v.value))
  return (
    <section className="targetBlock">
      <h3>Target</h3>
      <div className="targetRows">
        {values.map(row => (
          <div key={row.label} className="targetRow">
            <span>{row.label}</span>
            <b style={{ width: `${Math.max(8, row.value / max * 100)}%`, background: habit.color }}>{formatNumber(row.value)}</b>
          </div>
        ))}
      </div>
    </section>
  )
}

function ChartBlock({ title, period, offset, onPeriodChange, onOlder, onNewer, children }: {
  title: string
  period: PeriodKind
  offset: number
  onPeriodChange: (period: PeriodKind) => void
  onOlder: () => void
  onNewer: () => void
  children: React.ReactNode
}) {
  return (
    <section className="chartBlock">
      <header className="sectionHeader">
        <h3>{title}</h3>
        <div className="chartControls">
          <select value={period} onChange={e => onPeriodChange(e.target.value as PeriodKind)}>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="quarter">Quarter</option>
            <option value="year">Year</option>
          </select>
          <button type="button" className="smallGhost" onClick={onOlder}>‹</button>
          <button type="button" className="smallGhost" onClick={onNewer} disabled={offset === 0}>›</button>
        </div>
      </header>
      {children}
    </section>
  )
}

function ScoreChart({ habit, entries, period, offset, referenceDate }: { habit: Habit, entries: HabitEntry[], period: PeriodKind, offset: number, referenceDate: string }) {
  const points = useMemo(() => scoreChartPoints(habit, entries, period, offset, referenceDate), [habit, entries, period, offset, referenceDate])
  if (!points.length) return <p className="emptyText">No score data yet.</p>

  return <LineChart points={points} color={habit.color} />
}

function LineChart({ points, color }: { points: ScorePoint[], color: string }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const width = 100
  const height = 100
  const innerLeft = 8
  const innerRight = 3
  const innerTop = 6
  const innerBottom = 18
  const chartWidth = width - innerLeft - innerRight
  const chartHeight = height - innerTop - innerBottom
  const denom = Math.max(1, points.length - 1)
  const coords = points.map((point, index) => {
    const x = innerLeft + (index / denom) * chartWidth
    const y = innerTop + (1 - point.score) * chartHeight
    return { x, y, point }
  })
  const selected = selectedIndex === null ? null : coords[selectedIndex]
  const path = coords.map((c, index) => `${index === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(' ')

  return (
    <div
      className="scoreChartScroller"
      style={{
        '--tooltip-x': selected ? `${selected.x}%` : '50%',
        '--tooltip-y': selected ? `${selected.y}%` : '50%'
      } as CSSProperties}
    >
      <svg className="scoreSvg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Score chart">
        {[1, .8, .6, .4, .2, 0].map(level => {
          const y = innerTop + (1 - level) * chartHeight
          return <line key={level} x1={innerLeft} x2={width - innerRight} y1={y} y2={y} className="gridLine" />
        })}
        <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {coords.map((c, index) => {
          const percent = Math.round(c.point.score * 100)
          const label = `${formatLong(c.point.date)}: ${percent}%`
          return (
            <g
              key={c.point.date}
              className="scorePoint"
              role="button"
              tabIndex={0}
              aria-label={label}
              onClick={() => setSelectedIndex(index)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setSelectedIndex(index)
                }
              }}
            >
              <title>{label}</title>
              <circle className="scorePointHitbox" cx={c.x} cy={c.y} r="4.5" vectorEffect="non-scaling-stroke" />
              <circle
                className={selectedIndex === index ? 'scorePointDot selected' : 'scorePointDot'}
                cx={c.x}
                cy={c.y}
                r="1.5"
                fill={color}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          )
        })}
      </svg>

      {selected && (
        <div className="scorePointTooltip" role="status">
          <strong>{Math.round(selected.point.score * 100)}%</strong>
          <span>{formatLong(selected.point.date)}</span>
        </div>
      )}

      <div className="scoreYAxis">
        <span>100%</span><span>80%</span><span>60%</span><span>40%</span><span>20%</span>
      </div>
      <div className="scoreXAxis">
        {points.map((point, index) => <span key={`${point.date}-${index}`}>{axisLabel(point.date, index)}</span>)}
      </div>
    </div>
  )
}

function axisLabel(date: string, index: number): string {
  if (index === 0 || date.endsWith('-01')) return monthLabel(date)
  return String(new Date(`${date}T12:00:00`).getDate())
}

function HistoryChart({ habit, entries, period, offset, referenceDate }: { habit: Habit, entries: HabitEntry[], period: PeriodKind, offset: number, referenceDate: string }) {
  const points = historyPoints(habit, entries, period, offset, referenceDate)
  const max = Math.max(1, ...points.map(p => p.value))

  return (
    <div className="barChart" style={{ '--bar-color': habit.color } as CSSProperties}>
      {points.map(point => (
        <div className="barItem" key={point.key} title={`${point.label}: ${formatNumber(point.value)}`}>
          <span className="barValue">{point.value ? formatNumber(point.value) : ''}</span>
          <span className="barColumn" style={{ height: `${Math.max(3, point.value / max * 100)}%` }} />
          <small>{point.label}</small>
        </div>
      ))}
    </div>
  )
}

function CalendarGrid({ habit, entries, referenceDate, offsetWeeks, onEntriesChange }: { habit: Habit, entries: HabitEntry[], referenceDate: string, offsetWeeks: number, onEntriesChange: (entries: HabitEntry[]) => void }) {
  const visibleWeeks = 17
  const matrix = calendarMatrix(referenceDate, offsetWeeks, visibleWeeks)
  const markers = monthMarkers(matrix.weeks)
  const map = entryMap(entries, habit.id)

  return (
    <div className="calendarScroller">
      <div className="calendarMonthRow" style={{ gridTemplateColumns: `repeat(${visibleWeeks}, minmax(34px, 1fr)) 38px` }}>
        {matrix.weeks.map(week => {
          const marker = markers.find(m => m.week === week)
          return <span key={week}>{marker ? shortMonth(week) : ''}</span>
        })}
        <span />
      </div>
      <div className="habitCalendar" style={{ gridTemplateColumns: `repeat(${visibleWeeks}, minmax(34px, 1fr)) 38px` }}>
        {matrix.rows.map(row => (
          <div className="calendarRow" key={row.label} style={{ display: 'contents' }}>
            {row.dates.map(date => {
              const entry = map.get(date)
              const ok = successForDisplay(habit, entry?.value)
              return (
                <button
                  type="button"
                  key={date}
                  className={`calendarCell ${ok ? 'ok' : entry ? 'bad' : 'empty'}`}
                  style={{ background: ok ? habit.color : undefined }}
                  title={`${formatLong(date)}: ${displayValue(habit, entry?.value) || 'no data'}`}
                  onClick={() => onEntriesChange(toggleEntry(entries, habit, date))}
                >
                  {new Date(`${date}T12:00:00`).getDate()}
                </button>
              )
            })}
            <span className="weekdayLabel">{row.label}</span>
          </div>
        ))}
      </div>
      <button type="button" className="editCalendar" onClick={() => alert('Tap any day to toggle its value. For numerical habits, it toggles between 0 and 1.')}>EDIT</button>
    </div>
  )
}

function BestStreaks({ habit, entries, referenceDate }: { habit: Habit, entries: HabitEntry[], referenceDate: string }) {
  const streaks = bestStreaks(habit, entries, referenceDate)
  const max = Math.max(1, ...streaks.map(s => s.days))
  if (!streaks.length) return <p className="emptyText">No streaks yet.</p>

  return (
    <div className="streakList">
      {streaks.map(streak => (
        <div className="streakRow" key={`${streak.start}-${streak.end}`}>
          <span>{formatShort(streak.start)}</span>
          <b style={{ width: `${Math.max(20, streak.days / max * 100)}%` }}>{streak.days}</b>
          <span>{formatShort(streak.end)}</span>
        </div>
      ))}
    </div>
  )
}

function FrequencyChart({ habit, entries }: { habit: Habit, entries: HabitEntry[] }) {
  const values = weekdayFrequency(habit, entries)
  const max = Math.max(1, ...values)
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return (
    <div className="frequencyChart">
      <p className="frequencySummary">{frequencyLabel(habit)}</p>
      {labels.map((label, index) => (
        <div key={label} className="frequencyRow">
          <span>{label}</span>
          <b style={{ width: `${Math.max(8, values[index] / max * 100)}%`, background: habit.color }}>{formatNumber(values[index])}</b>
        </div>
      ))}
    </div>
  )
}
