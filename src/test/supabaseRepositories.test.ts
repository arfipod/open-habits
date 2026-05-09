import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import {
  appendUserDataFromImport,
  createHabit,
  deleteEntry,
  deleteHabitEntry,
  deleteEntryContext,
  deleteHabitEntryContext,
  deleteHabit,
  exportableDataForUser,
  fetchAppData,
  fetchEntryContexts,
  getCurrentUserId,
  loadAppData,
  loadHabitEntryContexts,
  recordImportBatch,
  replaceAppData,
  replaceAllUserDataFromImport,
  updateHabit,
  upsertEntry,
  upsertHabit,
  upsertHabitEntry,
  upsertEntryContext,
  upsertHabitEntryContext
} from '../lib/supabase/repositories'
import type { Database, HabitEntryContextRow, HabitEntryRow, HabitRow, ImportBatchRow } from '../lib/supabase/database.types'
import { FIXED_TIMESTAMP, USER_ID, makeContext, makeEntry, makeHabit, sampleAppData } from './fixtures/appData'

type Client = SupabaseClient<Database>

interface QueryResult {
  data?: unknown
  error?: { message: string } | null
}

interface QueryCall {
  table: string
  method: string
  args: unknown[]
}

function makeClient(results: Record<string, QueryResult[]> = {}, authUserId = USER_ID) {
  const calls: QueryCall[] = []
  const queues = new Map(Object.entries(results).map(([table, tableResults]) => [table, [...tableResults]]))
  const auth = {
    getUser: vi.fn(async () => ({ data: { user: { id: authUserId } }, error: null }))
  }
  const from = vi.fn((table: string) => {
    const queue = queues.get(table) ?? []
    const result = queue.shift() ?? { data: null, error: null }
    queues.set(table, queue)
    return makeBuilder(table, result, calls)
  })

  return {
    client: { auth, from } as unknown as Client,
    calls,
    auth,
    from
  }
}

function makeBuilder(table: string, result: QueryResult, calls: QueryCall[]) {
  const builder = {
    data: result.data ?? null,
    error: result.error ?? null,
    select: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'select', args })
      return builder
    }),
    eq: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'eq', args })
      return builder
    }),
    order: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'order', args })
      return builder
    }),
    insert: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'insert', args })
      return builder
    }),
    update: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'update', args })
      return builder
    }),
    upsert: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'upsert', args })
      return builder
    }),
    delete: vi.fn((...args: unknown[]) => {
      calls.push({ table, method: 'delete', args })
      return builder
    }),
    single: vi.fn(async () => {
      calls.push({ table, method: 'single', args: [] })
      return { data: result.data ?? null, error: result.error ?? null }
    }),
    maybeSingle: vi.fn(async () => {
      calls.push({ table, method: 'maybeSingle', args: [] })
      return { data: result.data ?? null, error: result.error ?? null }
    })
  }
  return builder
}

function habitRow(overrides: Partial<HabitRow> = {}): HabitRow {
  return {
    id: 'habit-read',
    user_id: USER_ID,
    position: '001',
    name: 'Read',
    type: 'YES_NO',
    question: 'Did you read?',
    description: 'Read books',
    frequency_numerator: 1,
    frequency_denominator: 1,
    color: '#2F80ED',
    unit: '',
    target_type: null,
    target_value: null,
    archived: false,
    source: 'open_habits',
    external_id: null,
    created_at: FIXED_TIMESTAMP,
    updated_at: FIXED_TIMESTAMP,
    ...overrides
  }
}

function entryRow(overrides: Partial<HabitEntryRow> = {}): HabitEntryRow {
  return {
    id: 'entry-1',
    user_id: USER_ID,
    habit_id: 'habit-read',
    date: '2026-05-09',
    value_kind: 'YES_MANUAL',
    numeric_value: null,
    notes: 'Morning',
    created_at: FIXED_TIMESTAMP,
    updated_at: FIXED_TIMESTAMP,
    ...overrides
  }
}

function contextRow(overrides: Partial<HabitEntryContextRow> = {}): HabitEntryContextRow {
  return {
    id: 'context-1',
    user_id: USER_ID,
    habit_id: 'habit-read',
    entry_id: 'entry-1',
    occurred_at: '2026-05-09T07:30:00',
    occurred_time: '07:30',
    location_text: 'Home office',
    comment: 'Felt focused',
    created_at: FIXED_TIMESTAMP,
    updated_at: FIXED_TIMESTAMP,
    ...overrides
  }
}

function importBatchRow(overrides: Partial<ImportBatchRow> = {}): ImportBatchRow {
  return {
    id: 'batch-1',
    user_id: USER_ID,
    source_app: 'loop_habit_tracker',
    file_name: 'loop.zip',
    habits_count: 1,
    entries_count: 1,
    metadata: { mode: 'replace' },
    created_at: FIXED_TIMESTAMP,
    ...overrides
  }
}

function expectUserFilter(calls: QueryCall[], table: string) {
  expect(calls).toEqual(expect.arrayContaining([
    expect.objectContaining({ table, method: 'eq', args: ['user_id', USER_ID] })
  ]))
}

describe('Supabase repositories with mocked clients', () => {
  it('fetches app data scoped to the authenticated user id passed in', async () => {
    const { client, calls } = makeClient({
      habits: [{ data: [habitRow({ position: '002' }), habitRow({ id: 'habit-a', position: '001', name: 'A' })] }],
      habit_entries: [{ data: [entryRow()] }],
      habit_entry_contexts: [{ data: [contextRow()] }]
    })

    const data = await fetchAppData(USER_ID, { client })

    expect(data.habits.map(habit => habit.position)).toEqual(['001', '002'])
    expect(data.entries).toEqual([expect.objectContaining({ id: 'entry-1', value: 'YES_MANUAL' })])
    expect(data.entryContexts).toEqual([expect.objectContaining({ id: 'context-1', locationText: 'Home office' })])
    expectUserFilter(calls, 'habits')
    expectUserFilter(calls, 'habit_entries')
    expectUserFilter(calls, 'habit_entry_contexts')
  })

  it('loads app data after resolving the current user without credentials in the test', async () => {
    const { client, auth } = makeClient({
      habits: [{ data: [habitRow()] }],
      habit_entries: [{ data: [] }],
      habit_entry_contexts: [{ data: [] }]
    })

    const data = await loadAppData({ client })

    expect(auth.getUser).toHaveBeenCalled()
    expect(data.habits[0].id).toBe('habit-read')
  })

  it('creates habits with user_id in the insert payload', async () => {
    const habit = makeHabit()
    const { client, calls } = makeClient({ habits: [{ data: habitRow() }] })

    const saved = await createHabit(habit, { client, userId: USER_ID })

    expect(saved.id).toBe(habit.id)
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'habits',
        method: 'insert',
        args: [expect.objectContaining({ id: habit.id, user_id: USER_ID })]
      })
    ]))
  })

  it('upserts habits with user_id and id conflict metadata', async () => {
    const habit = makeHabit({ name: 'Read more' })
    const { client, calls } = makeClient({ habits: [{ data: habitRow({ name: 'Read more' }) }] })

    const saved = await upsertHabit(habit, { client, userId: USER_ID })

    expect(saved.name).toBe('Read more')
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'habits',
        method: 'upsert',
        args: [expect.objectContaining({ id: habit.id, user_id: USER_ID }), { onConflict: 'id' }]
      })
    ]))
  })

  it('updates and deletes habits with id and user filters', async () => {
    const habit = makeHabit({ name: 'Read nightly' })
    const updateClient = makeClient({ habits: [{ data: habitRow({ name: 'Read nightly' }) }] })
    const deleteClient = makeClient({ habits: [{ data: null }] })

    await updateHabit(habit, { client: updateClient.client, userId: USER_ID })
    await deleteHabit(habit.id, { client: deleteClient.client, userId: USER_ID })

    expect(updateClient.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'habits', method: 'update', args: [expect.objectContaining({ name: 'Read nightly' })] }),
      expect.objectContaining({ table: 'habits', method: 'eq', args: ['id', habit.id] }),
      expect.objectContaining({ table: 'habits', method: 'eq', args: ['user_id', USER_ID] })
    ]))
    expect(deleteClient.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'habits', method: 'delete' }),
      expect.objectContaining({ table: 'habits', method: 'eq', args: ['id', habit.id] }),
      expect.objectContaining({ table: 'habits', method: 'eq', args: ['user_id', USER_ID] })
    ]))
  })

  it('upserts an existing entry by querying user, habit and date first', async () => {
    const entry = makeEntry({ id: 'entry-local', value: 'NO' })
    const { client, calls } = makeClient({
      habit_entries: [
        { data: { id: 'entry-db' } },
        { data: entryRow({ id: 'entry-db', value_kind: 'NO', notes: '' }) }
      ]
    })

    const saved = await upsertEntry(entry, { client, userId: USER_ID })

    expect(saved).toMatchObject({ id: 'entry-db', value: 'NO' })
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'habit_entries', method: 'eq', args: ['user_id', USER_ID] }),
      expect.objectContaining({ table: 'habit_entries', method: 'eq', args: ['habit_id', entry.habitId] }),
      expect.objectContaining({ table: 'habit_entries', method: 'eq', args: ['date', entry.date] }),
      expect.objectContaining({ table: 'habit_entries', method: 'update', args: [expect.objectContaining({ value_kind: 'NO' })] }),
      expect.objectContaining({ table: 'habit_entries', method: 'eq', args: ['id', 'entry-db'] })
    ]))
  })

  it('inserts a new entry with user_id when no entry exists for the habit date', async () => {
    const entry = makeEntry()
    const { client, calls } = makeClient({
      habit_entries: [
        { data: null },
        { data: entryRow() }
      ]
    })

    await upsertEntry(entry, { client, userId: USER_ID })

    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'habit_entries',
        method: 'insert',
        args: [expect.objectContaining({ id: entry.id, user_id: USER_ID, habit_id: entry.habitId })]
      })
    ]))
  })

  it('deletes entries with user scope', async () => {
    const { client, calls } = makeClient({ habit_entries: [{ data: null }] })

    await deleteEntry('entry-1', { client, userId: USER_ID })

    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'habit_entries', method: 'delete' }),
      expect.objectContaining({ table: 'habit_entries', method: 'eq', args: ['id', 'entry-1'] }),
      expect.objectContaining({ table: 'habit_entries', method: 'eq', args: ['user_id', USER_ID] })
    ]))
  })

  it('keeps entry alias helpers wired to the same scoped operations', async () => {
    const entry = makeEntry()
    const upsertClient = makeClient({
      habit_entries: [
        { data: null },
        { data: entryRow() }
      ]
    })
    const deleteClient = makeClient({ habit_entries: [{ data: null }] })

    await upsertHabitEntry(entry, { client: upsertClient.client, userId: USER_ID })
    await deleteHabitEntry('entry-1', { client: deleteClient.client, userId: USER_ID })

    expect(upsertClient.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'habit_entries', method: 'insert' })
    ]))
    expect(deleteClient.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'habit_entries', method: 'eq', args: ['user_id', USER_ID] })
    ]))
  })

  it('replaces all user data from import, records the batch and refetches fresh data', async () => {
    const imported = sampleAppData()
    const { client, calls } = makeClient({
      habit_entry_contexts: [
        { data: null },
        { data: null },
        { data: [contextRow({ entry_id: imported.entryContexts[0].entryId })] }
      ],
      habit_entries: [
        { data: null },
        { data: null },
        { data: [entryRow()] }
      ],
      import_batches: [
        { data: null },
        { data: importBatchRow() }
      ],
      habits: [
        { data: null },
        { data: null },
        { data: [habitRow()] }
      ]
    })

    const data = await replaceAllUserDataFromImport(imported, 'loop.zip', { client, userId: USER_ID })

    expect(data.habits).toHaveLength(1)
    for (const table of ['habit_entry_contexts', 'habit_entries', 'import_batches', 'habits']) {
      expect(calls).toEqual(expect.arrayContaining([
        expect.objectContaining({ table, method: 'delete' }),
        expect.objectContaining({ table, method: 'eq', args: ['user_id', USER_ID] })
      ]))
    }
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'habits', method: 'insert', args: [expect.arrayContaining([expect.objectContaining({ user_id: USER_ID })])] }),
      expect.objectContaining({ table: 'habit_entries', method: 'insert', args: [expect.arrayContaining([expect.objectContaining({ user_id: USER_ID })])] }),
      expect.objectContaining({ table: 'habit_entry_contexts', method: 'insert', args: [expect.arrayContaining([expect.objectContaining({ user_id: USER_ID })])] }),
      expect.objectContaining({ table: 'import_batches', method: 'insert', args: [expect.objectContaining({ file_name: 'loop.zip', metadata: { mode: 'replace' } })] })
    ]))
  })

  it('appends imported data, uses replaceAppData wrapper and loads exportable data', async () => {
    const imported = sampleAppData()
    const appendClient = makeClient({
      habits: [{ data: null }, { data: [habitRow()] }],
      habit_entries: [{ data: null }, { data: [entryRow()] }],
      habit_entry_contexts: [{ data: null }, { data: [contextRow()] }],
      import_batches: [{ data: importBatchRow({ metadata: { mode: 'append' } }) }]
    })
    const replaceClient = makeClient({
      habit_entry_contexts: [{ data: null }, { data: null }, { data: [] }],
      habit_entries: [{ data: null }, { data: null }, { data: [] }],
      import_batches: [{ data: null }, { data: importBatchRow({ file_name: null }) }],
      habits: [{ data: null }, { data: null }, { data: [] }]
    })
    const exportClient = makeClient({
      habits: [{ data: [habitRow()] }],
      habit_entries: [{ data: [entryRow()] }],
      habit_entry_contexts: [{ data: [contextRow()] }]
    })

    await appendUserDataFromImport(imported, 'loop.zip', { client: appendClient.client, userId: USER_ID })
    await replaceAppData({ habits: [], entries: [], entryContexts: [] }, { client: replaceClient.client, userId: USER_ID })
    const exported = await exportableDataForUser({ client: exportClient.client, userId: USER_ID })

    expect(appendClient.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'import_batches', method: 'insert', args: [expect.objectContaining({ metadata: { mode: 'append' } })] })
    ]))
    expect(replaceClient.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'import_batches', method: 'insert', args: [expect.objectContaining({ file_name: null, metadata: { mode: 'replace' } })] })
    ]))
    expect(exported.habits).toHaveLength(1)
  })

  it('records an import batch with default source metadata', async () => {
    const { client, calls } = makeClient({
      import_batches: [{ data: importBatchRow({ metadata: { mode: 'append' } }) }]
    })

    const batch = await recordImportBatch(
      { fileName: 'loop.zip', habitsCount: 2, entriesCount: 5, metadata: { mode: 'append' } },
      { client, userId: USER_ID }
    )

    expect(batch.id).toBe('batch-1')
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'import_batches',
        method: 'insert',
        args: [expect.objectContaining({
          user_id: USER_ID,
          source_app: 'loop_habit_tracker',
          habits_count: 2,
          entries_count: 5,
          metadata: { mode: 'append' }
        })]
      })
    ]))
  })

  it('upserts and deletes optional entry context with user scope', async () => {
    const context = makeContext({ entryId: 'entry-1' })
    const upsertClient = makeClient({ habit_entry_contexts: [{ data: contextRow() }] })
    const deleteClient = makeClient({ habit_entry_contexts: [{ data: null }] })

    const saved = await upsertEntryContext(context, { client: upsertClient.client, userId: USER_ID })
    await deleteEntryContext(context.entryId, { client: deleteClient.client, userId: USER_ID })

    expect(saved).toMatchObject({ id: 'context-1', comment: 'Felt focused' })
    expect(upsertClient.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'habit_entry_contexts',
        method: 'upsert',
        args: [
          expect.objectContaining({ user_id: USER_ID, entry_id: 'entry-1' }),
          { onConflict: 'entry_id' }
        ]
      })
    ]))
    expect(deleteClient.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'habit_entry_contexts', method: 'delete' }),
      expect.objectContaining({ table: 'habit_entry_contexts', method: 'eq', args: ['entry_id', 'entry-1'] }),
      expect.objectContaining({ table: 'habit_entry_contexts', method: 'eq', args: ['user_id', USER_ID] })
    ]))
  })

  it('loads entry contexts and keeps context alias helpers wired', async () => {
    const fetchClient = makeClient({ habit_entry_contexts: [{ data: [contextRow()] }] })
    const loadClient = makeClient({ habit_entry_contexts: [{ data: [contextRow()] }] })
    const upsertClient = makeClient({ habit_entry_contexts: [{ data: contextRow() }] })
    const deleteClient = makeClient({ habit_entry_contexts: [{ data: null }] })

    expect(await fetchEntryContexts(USER_ID, { client: fetchClient.client })).toHaveLength(1)
    expect(await loadHabitEntryContexts({ client: loadClient.client, userId: USER_ID })).toHaveLength(1)
    await upsertHabitEntryContext(makeContext({ entryId: 'entry-1' }), { client: upsertClient.client, userId: USER_ID })
    await deleteHabitEntryContext('entry-1', { client: deleteClient.client, userId: USER_ID })

    expectUserFilter(fetchClient.calls, 'habit_entry_contexts')
    expectUserFilter(loadClient.calls, 'habit_entry_contexts')
    expect(upsertClient.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'habit_entry_contexts', method: 'upsert' })
    ]))
    expect(deleteClient.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'habit_entry_contexts', method: 'delete' })
    ]))
  })

  it('surfaces authentication errors before repository operations', async () => {
    const calls: QueryCall[] = []
    const client = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: null }, error: null }))
      },
      from: vi.fn((table: string) => makeBuilder(table, { data: null }, calls))
    } as unknown as Client

    await expect(getCurrentUserId(client)).rejects.toThrow('not authenticated')
  })

  it('throws database errors from query results', async () => {
    const fetchClient = makeClient({ habits: [{ error: { message: 'habit query failed' } }] })
    const createClient = makeClient({ habits: [{ error: { message: 'insert failed' } }] })
    const existingEntryClient = makeClient({ habit_entries: [{ error: { message: 'lookup failed' } }] })
    const contextClient = makeClient({ habit_entry_contexts: [{ error: { message: 'context failed' } }] })

    await expect(fetchAppData(USER_ID, { client: fetchClient.client })).rejects.toThrow('habit query failed')
    await expect(createHabit(makeHabit(), { client: createClient.client, userId: USER_ID })).rejects.toThrow('insert failed')
    await expect(upsertEntry(makeEntry(), { client: existingEntryClient.client, userId: USER_ID })).rejects.toThrow('lookup failed')
    await expect(fetchEntryContexts(USER_ID, { client: contextClient.client })).rejects.toThrow('context failed')
  })
})
