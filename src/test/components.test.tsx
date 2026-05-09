import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HabitForm } from '../components/HabitForm'
import { HabitList } from '../components/HabitList'
import { makeEntry, makeHabit, makeNumericalHabit } from './fixtures/appData'

describe('component interactions', () => {
  it('edits numerical habit fields and deletes through HabitForm', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onCancel = vi.fn()
    const onDelete = vi.fn()
    const habit = makeNumericalHabit({ targetType: 'AT_LEAST', targetValue: 2 })

    render(<HabitForm habit={habit} onCancel={onCancel} onSave={onSave} onDelete={onDelete} />)

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Water limit')
    await user.selectOptions(screen.getByLabelText('Target type'), 'AT_MOST')
    await user.clear(screen.getByLabelText('Target value'))
    await user.type(screen.getByLabelText('Target value'), '0')
    await user.clear(screen.getByLabelText('Frequency: numerator'))
    await user.type(screen.getByLabelText('Frequency: numerator'), '3')
    await user.clear(screen.getByLabelText('Frequency: denominator'))
    await user.type(screen.getByLabelText('Frequency: denominator'), '7')
    await user.click(screen.getByLabelText('Archived'))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Water limit',
      targetType: 'AT_MOST',
      targetValue: 0,
      frequencyNumerator: 3,
      frequencyDenominator: 7,
      archived: true
    }))

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith(habit.id)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('changes a yes/no HabitForm into a numerical habit', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(<HabitForm habit={makeHabit()} onCancel={vi.fn()} onSave={onSave} />)

    await user.selectOptions(screen.getByLabelText('Type'), 'NUMERICAL')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      type: 'NUMERICAL',
      targetType: 'AT_LEAST',
      targetValue: 1
    }))
  })

  it('toggles entries from the habit list without selecting the row', async () => {
    const user = userEvent.setup()
    const habit = makeHabit()
    const onSelect = vi.fn()
    const onEntriesChange = vi.fn()

    render(
      <HabitList
        habits={[habit]}
        entries={[makeEntry({ habitId: habit.id, date: '2026-05-09', value: 'NO' })]}
        selectedId={null}
        onSelect={onSelect}
        onEntriesChange={onEntriesChange}
      />
    )

    const row = screen.getByRole('button', { name: /Read/ })
    await user.click(within(row).getByTitle('2026-05-09: ×'))

    expect(onEntriesChange).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ habitId: habit.id, date: '2026-05-09', value: 'YES_MANUAL' })
    ]))
    expect(onSelect).not.toHaveBeenCalled()

    await user.click(row)
    expect(onSelect).toHaveBeenCalledWith(habit.id)
  })
})
