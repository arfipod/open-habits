import { describe, expect, it } from 'vitest'
import {
  ENTRY,
  bestStreaks,
  calendarMatrix,
  createId,
  cropText,
  dateDistanceLabel,
  dateFromInput,
  defaultHabit,
  displayValue,
  entryToInt,
  formatNumber,
  historyPoints,
  intToEntryValue,
  isKnown,
  latestScore,
  monthMarkers,
  monthName,
  normalizeHabit,
  numericAmount,
  periodRange,
  periodTotal,
  scoreAtOrBefore,
  scoreChartPoints,
  scoreSeries,
  successForDisplay,
  toggleEntry,
  upsertEntry,
  weekdayFrequency
} from '../lib/calculations'
import { sameMonth } from '../lib/date'
import { entriesFor, makeEntry, makeHabit, makeNumericalHabit } from './fixtures/appData'

describe('entry editing calculations', () => {
  it('creates UUID-shaped ids for Supabase rows', () => {
    expect(createId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('toggles yes/no entries without changing unrelated entries', () => {
    const habit = defaultHabit(1)
    const otherHabit = defaultHabit(2)
    const otherEntries = upsertEntry([], otherHabit, '2026-05-09', 'yes')

    const next = toggleEntry(otherEntries, habit, '2026-05-09')

    expect(next).toHaveLength(2)
    expect(next.find(entry => entry.habitId === habit.id)?.value).toBe('YES_MANUAL')
    expect(next.find(entry => entry.habitId === otherHabit.id)?.value).toBe('YES_MANUAL')
  })

  it('stores numerical habit values scaled by 1000', () => {
    const habit = {
      ...defaultHabit(1),
      type: 'NUMERICAL' as const,
      targetType: 'AT_LEAST' as const,
      targetValue: 2
    }

    const entries = upsertEntry([], habit, '2026-05-09', '1.25')

    expect(entries[0].value).toBe(1250)
  })
})

describe('score and target calculations', () => {
  it('computes deterministic daily YES_NO scores', () => {
    const habit = makeHabit()
    const entries = entriesFor(habit, [
      ['2026-05-01', 'YES_MANUAL'],
      ['2026-05-02', 'YES_MANUAL'],
      ['2026-05-03', 'YES_MANUAL']
    ])

    const series = scoreSeries(habit, entries, '2026-05-03')

    expect(series.map(point => point.date)).toEqual(['2026-05-01', '2026-05-02', '2026-05-03'])
    expect(series[0].score).toBeCloseTo(0.05192249, 6)
    expect(series[2].score).toBeCloseTo(0.1478196, 6)
    expect(latestScore(habit, entries, '2026-05-03')).toBeCloseTo(series[2].score, 8)
  })

  it('computes rolling YES_NO scores for a 3/7 frequency', () => {
    const habit = makeHabit({ frequencyNumerator: 3, frequencyDenominator: 7 })
    const entries = entriesFor(habit, [
      ['2026-05-01', 'YES_MANUAL'],
      ['2026-05-03', 'YES_MANUAL'],
      ['2026-05-05', 'YES_MANUAL']
    ])

    const series = scoreSeries(habit, entries, '2026-05-07')

    expect(series).toHaveLength(7)
    expect(series[series.length - 1].score).toBeCloseTo(0.07939064, 6)
  })

  it('computes NUMERICAL AT_LEAST scores and preserves score on SKIP', () => {
    const habit = makeNumericalHabit({ targetValue: 2 })
    const entries = entriesFor(habit, [
      ['2026-05-01', 2000],
      ['2026-05-02', 1000],
      ['2026-05-03', 'SKIP']
    ])

    const series = scoreSeries(habit, entries, '2026-05-03')

    expect(series[0].score).toBeCloseTo(0.05192249, 6)
    expect(series[1].score).toBeCloseTo(0.07518778, 6)
    expect(series[2].score).toBe(series[1].score)
  })

  it('computes NUMERICAL AT_MOST scores with an initially perfect score', () => {
    const habit = makeNumericalHabit({ targetType: 'AT_MOST', targetValue: 3 })
    const entries = entriesFor(habit, [
      ['2026-05-01', 2000],
      ['2026-05-02', 6000]
    ])

    const series = scoreSeries(habit, entries, '2026-05-02')

    expect(series[0].score).toBe(1)
    expect(series[1].score).toBeCloseTo(0.94807751, 6)
  })

  it('handles a No PMO style AT_MOST target of zero', () => {
    const habit = makeNumericalHabit({ name: 'No PMO', targetType: 'AT_MOST', targetValue: 0 })
    const entries = entriesFor(habit, [
      ['2026-05-01', 0],
      ['2026-05-02', 1000]
    ])

    expect(successForDisplay(habit, 0)).toBe(true)
    expect(successForDisplay(habit, 1000)).toBe(false)
    expect(scoreSeries(habit, entries, '2026-05-01')[0].score).toBe(1)
    expect(scoreSeries(habit, entries, '2026-05-02')[1].score).toBeCloseTo(0.94807751, 6)
  })

  it('distinguishes SKIP, UNKNOWN and displayed values', () => {
    const habit = makeHabit()

    expect(successForDisplay(habit, 'SKIP')).toBe(true)
    expect(successForDisplay(habit, 'UNKNOWN')).toBe(false)
    expect(displayValue(habit, 'YES_AUTO')).toBe('✓')
    expect(displayValue(habit, 'NO')).toBe('×')
    expect(displayValue(habit, 'SKIP')).toBe('–')
    expect(displayValue(habit, undefined)).toBe('')
    expect(entryToInt(undefined)).toBe(ENTRY.UNKNOWN)
    expect(intToEntryValue(ENTRY.YES_MANUAL)).toBe('YES_MANUAL')
    expect(intToEntryValue(1234)).toBe(1234)
    expect(isKnown('YES_MANUAL')).toBe(true)
    expect(isKnown('UNKNOWN')).toBe(false)
    expect(isKnown(undefined)).toBe(false)
    expect(numericAmount('SKIP')).toBe(0)
  })

  it('uses a rolling numerical sum over the habit frequency window', () => {
    const habit = makeNumericalHabit({ frequencyNumerator: 1, frequencyDenominator: 3, targetValue: 6 })
    const entries = entriesFor(habit, [
      ['2026-05-01', 2000],
      ['2026-05-02', 2000],
      ['2026-05-03', 2000]
    ])

    const series = scoreSeries(habit, entries, '2026-05-03')

    expect(series[0].score).toBeCloseTo(0.01010492, 6)
    expect(series[1].score).toBeCloseTo(0.03000842, 6)
    expect(series[2].score).toBeCloseTo(0.05941348, 6)
  })

  it('summarizes targets for today, week, month, quarter and year', () => {
    const habit = makeHabit()
    const entries = entriesFor(habit, [
      ['2026-01-01', 'YES_MANUAL'],
      ['2026-01-02', 'YES_MANUAL'],
      ['2026-02-10', 'YES_MANUAL'],
      ['2026-04-01', 'YES_MANUAL'],
      ['2026-05-09', 'YES_MANUAL']
    ])

    expect(periodRange('week', '2026-05-09')).toEqual({ start: '2026-05-04', end: '2026-05-09' })
    expect(periodTotal(habit, entries, 'today', '2026-05-09')).toBe(1)
    expect(periodTotal(habit, entries, 'week', '2026-05-09')).toBe(1)
    expect(periodTotal(habit, entries, 'month', '2026-05-09')).toBe(1)
    expect(periodTotal(habit, entries, 'quarter', '2026-05-09')).toBe(2)
    expect(periodTotal(habit, entries, 'year', '2026-05-09')).toBe(5)
  })
})

describe('history, calendar, streak and frequency calculations', () => {
  it('groups history by week, month, quarter and year', () => {
    const habit = makeHabit()
    const entries = entriesFor(habit, [
      ['2026-01-01', 'YES_MANUAL'],
      ['2026-01-02', 'YES_MANUAL'],
      ['2026-02-10', 'YES_MANUAL'],
      ['2026-04-01', 'YES_MANUAL'],
      ['2026-05-09', 'YES_MANUAL']
    ])

    const weekPoints = historyPoints(habit, entries, 'week', 0, '2026-05-09')
    expect(weekPoints[weekPoints.length - 1]).toMatchObject({
      start: '2026-05-04',
      end: '2026-05-10',
      value: 1
    })
    expect(historyPoints(habit, entries, 'month', 0, '2026-05-09').find(point => point.start === '2026-01-01')?.value).toBe(2)
    expect(historyPoints(habit, entries, 'quarter', 0, '2026-05-09').find(point => point.start === '2026-04-01')?.value).toBe(2)
    expect(historyPoints(habit, entries, 'year', 0, '2026-05-09').find(point => point.start === '2026-01-01')?.value).toBe(5)
  })

  it('builds score chart points at or before period anchors', () => {
    const habit = makeHabit()
    const entries = entriesFor(habit, [
      ['2026-04-25', 'YES_MANUAL'],
      ['2026-05-02', 'YES_MANUAL'],
      ['2026-05-09', 'YES_MANUAL']
    ])
    const series = scoreSeries(habit, entries, '2026-05-09')

    expect(scoreAtOrBefore(series, '2026-05-01')?.date).toBe('2026-05-01')
    const chartPoints = scoreChartPoints(habit, entries, 'week', 0, '2026-05-09')
    expect(chartPoints[chartPoints.length - 1]).toMatchObject({
      date: '2026-05-09'
    })
  })

  it('returns best streaks ordered by length then start date', () => {
    const habit = makeHabit()
    const entries = entriesFor(habit, [
      ['2026-01-01', 'YES_MANUAL'],
      ['2026-01-02', 'YES_MANUAL'],
      ['2026-01-03', 'NO'],
      ['2026-01-04', 'YES_MANUAL'],
      ['2026-01-05', 'SKIP'],
      ['2026-01-06', 'YES_MANUAL']
    ])

    expect(bestStreaks(habit, entries, '2026-01-07')).toEqual([
      { start: '2026-01-04', end: '2026-01-06', days: 3 },
      { start: '2026-01-01', end: '2026-01-02', days: 2 }
    ])
  })

  it('builds the calendar grid and month markers', () => {
    const matrix = calendarMatrix('2026-05-09', 0, 2)

    expect(matrix.weeks).toEqual(['2026-04-27', '2026-05-04'])
    expect(matrix.rows[0]).toEqual({ label: 'Mon', dates: ['2026-04-27', '2026-05-04'] })
    expect(matrix.rows[5].dates[1]).toBe('2026-05-09')
    expect(monthMarkers(matrix.weeks)).toEqual([
      { week: '2026-04-27', label: 'Apr' },
      { week: '2026-05-04', label: 'May' }
    ])
  })

  it('sums successful entries by weekday frequency', () => {
    const habit = makeHabit()
    const entries = entriesFor(habit, [
      ['2026-05-04', 'YES_MANUAL'],
      ['2026-05-05', 'NO'],
      ['2026-05-06', 'SKIP'],
      ['2026-05-10', 'YES_MANUAL']
    ])

    expect(weekdayFrequency(habit, entries)).toEqual([1, 0, 1, 0, 0, 0, 1])
  })
})

describe('small formatting helpers', () => {
  it('formats numbers and date distances predictably', () => {
    expect(formatNumber(2)).toBe('2')
    expect(formatNumber(2.5)).toBe('2.5')
    expect(dateDistanceLabel('2026-05-09', '2026-05-09')).toBe('today')
    expect(dateDistanceLabel('2026-05-09', '2026-05-10')).toBe('1 day')
    expect(dateDistanceLabel('2026-05-09', '2026-05-12')).toBe('3 days')
    expect(monthName('2026-05-09')).toBe('May')
  })

  it('updates existing entries without changing unrelated entries', () => {
    const habit = makeHabit()
    const other = makeHabit({ id: 'habit-other', position: '002', name: 'Other' })
    const existing = makeEntry({ id: 'entry-existing', habitId: habit.id, date: '2026-05-09', value: 'NO' })
    const otherEntry = makeEntry({ id: 'entry-other', habitId: other.id, date: '2026-05-09', value: 'YES_MANUAL' })

    const next = upsertEntry([existing, otherEntry], habit, '2026-05-09', 'yes', 'done')

    expect(next).toHaveLength(2)
    expect(next.find(entry => entry.id === existing.id)).toMatchObject({ value: 'YES_MANUAL', notes: 'done' })
    expect(next.find(entry => entry.id === otherEntry.id)).toEqual(otherEntry)
  })

  it('toggles numerical entries and normalizes habit targets', () => {
    const habit = makeNumericalHabit({ targetType: '', targetValue: null, frequencyNumerator: 0, frequencyDenominator: 0 })
    const first = toggleEntry([], habit, '2026-05-09')
    const second = toggleEntry(first, habit, '2026-05-09')

    expect(first[0].value).toBe(1000)
    expect(second[0].value).toBe(0)
    expect(normalizeHabit(habit)).toMatchObject({
      frequencyNumerator: 1,
      frequencyDenominator: 1,
      targetType: 'AT_LEAST',
      targetValue: 1
    })
    expect(normalizeHabit(makeHabit({ targetType: 'AT_LEAST', targetValue: 4 }))).toMatchObject({
      targetType: '',
      targetValue: null
    })
  })

  it('crops long labels and parses input dates', () => {
    expect(cropText('abcdefghijklmnopqrstuvwxyz', 8)).toBe('abcdefg…')
    expect(dateFromInput('2026-05-09')).toBe('2026-05-09')
    expect(sameMonth('2026-05-01', '2026-05-31')).toBe(true)
    expect(sameMonth('2026-05-31', '2026-06-01')).toBe(false)
  })
})
