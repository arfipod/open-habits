import { FormEvent, useState } from 'react'
import type { Habit, HabitType, TargetType } from '../types'
import { normalizeHabit } from '../lib/calculations'

type FrequencyUnit = 'days' | 'weeks' | 'months'

interface Props {
  habit: Habit
  onCancel: () => void
  onSave: (habit: Habit) => void
  onDelete?: (habitId: string) => void
}

export function HabitForm({ habit, onCancel, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<Habit>(habit)
  const [frequencyPeriod, setFrequencyPeriod] = useState(() => frequencyPeriodFromDenominator(habit.frequencyDenominator))

  function update<K extends keyof Habit>(key: K, value: Habit[K]) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    onSave(normalizeHabit(draft))
  }

  function updateFrequencyPeriod(next: { count?: number, unit?: FrequencyUnit }) {
    const period = {
      count: next.count ?? frequencyPeriod.count,
      unit: next.unit ?? frequencyPeriod.unit
    }
    setFrequencyPeriod(period)
    update('frequencyDenominator', denominatorFromPeriod(period))
  }

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <form className="habitForm" onSubmit={submit}>
        <header className="modalHeader">
          <h2>{habit.name ? 'Edit habit' : 'New habit'}</h2>
          <button type="button" className="ghost" onClick={onCancel}>×</button>
        </header>

        <label>
          Name
          <input value={draft.name} onChange={e => update('name', e.target.value)} required />
        </label>

        <label>
          Question
          <input value={draft.question} onChange={e => update('question', e.target.value)} placeholder="Did you do it today?" />
        </label>

        <label>
          Description
          <textarea value={draft.description} onChange={e => update('description', e.target.value)} rows={3} />
        </label>

        <div className="twoCols">
          <label>
            Type
            <select value={draft.type} onChange={e => update('type', e.target.value as HabitType)}>
              <option value="YES_NO">Yes / No</option>
              <option value="NUMERICAL">Numerical</option>
            </select>
          </label>

          <label>
            Color
            <input type="color" value={draft.color} onChange={e => update('color', e.target.value)} />
          </label>
        </div>

        <fieldset className="frequencyBuilder">
          <legend>Frequency</legend>
          <span className="frequencyText">At least</span>
          <label>
            Times
            <input type="number" min={1} value={draft.frequencyNumerator} onChange={e => update('frequencyNumerator', Number(e.target.value))} />
          </label>
          <span className="frequencyText">time(s) every</span>
          <label>
            Period count
            <input type="number" min={1} value={frequencyPeriod.count} onChange={e => updateFrequencyPeriod({ count: Number(e.target.value) })} />
          </label>
          <label>
            Period unit
            <select value={frequencyPeriod.unit} onChange={e => updateFrequencyPeriod({ unit: e.target.value as FrequencyUnit })}>
              <option value="days">day(s)</option>
              <option value="weeks">week(s)</option>
              <option value="months">month(s)</option>
            </select>
          </label>
          <small>{frequencyPreview(draft.frequencyNumerator, frequencyPeriod)}</small>
        </fieldset>

        {draft.type === 'NUMERICAL' && (
          <div className="twoCols">
            <label>
              Target type
              <select value={draft.targetType || 'AT_LEAST'} onChange={e => update('targetType', e.target.value as TargetType)}>
                <option value="AT_LEAST">At least</option>
                <option value="AT_MOST">At most</option>
              </select>
            </label>
            <label>
              Target value
              <input type="number" step="0.01" value={draft.targetValue ?? 1} onChange={e => update('targetValue', Number(e.target.value))} />
            </label>
          </div>
        )}

        <label className="inlineCheck">
          <input type="checkbox" checked={draft.archived} onChange={e => update('archived', e.target.checked)} />
          Archived
        </label>

        <footer className="modalActions">
          {onDelete && <button type="button" className="danger" onClick={() => onDelete(draft.id)}>Delete</button>}
          <span />
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
          <button type="submit">Save</button>
        </footer>
      </form>
    </div>
  )
}

function frequencyPeriodFromDenominator(denominator: number): { count: number, unit: FrequencyUnit } {
  const safe = Math.max(1, Math.round(denominator || 1))
  if (safe % 30 === 0) return { count: safe / 30, unit: 'months' }
  if (safe % 7 === 0) return { count: safe / 7, unit: 'weeks' }
  return { count: safe, unit: 'days' }
}

function denominatorFromPeriod(period: { count: number, unit: FrequencyUnit }): number {
  const count = Math.max(1, Math.round(period.count || 1))
  if (period.unit === 'months') return count * 30
  if (period.unit === 'weeks') return count * 7
  return count
}

function frequencyPreview(times: number, period: { count: number, unit: FrequencyUnit }): string {
  const count = Math.max(1, Math.round(period.count || 1))
  const unit = period.unit === 'days' ? 'day' : period.unit === 'weeks' ? 'week' : 'month'
  const pluralUnit = count === 1 ? unit : `${unit}s`
  const cleanTimes = Math.max(1, Math.round(times || 1))
  return `At least ${cleanTimes} time${cleanTimes === 1 ? '' : 's'} every ${count} ${pluralUnit}.`
}
