import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppData, Habit, HabitEntry, HabitEntryContext } from '../../types'
import type {
  Database,
  ImportBatchRow,
  Json
} from './database.types'
import { supabase } from './client'
import {
  contextRowToHabitEntryContext,
  contextToInsert,
  entryRowToHabitEntry,
  entryToInsert,
  entryToUpdate,
  habitRowToHabit,
  habitToInsert,
  habitToUpdate
} from './mappers'

type Client = SupabaseClient<Database>

export interface RepositoryOptions {
  client?: Client
  userId?: string
}

export interface ImportBatchInput {
  sourceApp?: string
  fileName?: string | null
  habitsCount: number
  entriesCount: number
  metadata?: Json
}

export async function getCurrentUserId(client: Client = supabase): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Supabase user is not authenticated.')
  return data.user.id
}

export async function fetchAppData(userId: string, options: RepositoryOptions = {}): Promise<AppData> {
  const client = repositoryClient(options)

  const [habitsResult, entriesResult, contextsResult] = await Promise.all([
    client
      .from('habits')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true }),
    client
      .from('habit_entries')
      .select('*')
      .eq('user_id', userId)
      .order('habit_id', { ascending: true })
      .order('date', { ascending: false }),
    client
      .from('habit_entry_contexts')
      .select('*')
      .eq('user_id', userId)
      .order('habit_id', { ascending: true })
  ])

  if (habitsResult.error) throw new Error(habitsResult.error.message)
  if (entriesResult.error) throw new Error(entriesResult.error.message)
  if (contextsResult.error) throw new Error(contextsResult.error.message)

  return sortData({
    habits: (habitsResult.data ?? []).map(habitRowToHabit),
    entries: (entriesResult.data ?? []).map(entryRowToHabitEntry),
    entryContexts: (contextsResult.data ?? []).map(contextRowToHabitEntryContext)
  })
}

export async function loadAppData(options: RepositoryOptions = {}): Promise<AppData> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  return fetchAppData(userId, { client })
}

export async function createHabit(habit: Habit, options: RepositoryOptions = {}): Promise<Habit> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  const { data, error } = await client
    .from('habits')
    .insert(habitToInsert(habit, userId))
    .select()
    .single()

  if (error) throw new Error(error.message)
  return habitRowToHabit(data)
}

export async function upsertHabit(habit: Habit, options: RepositoryOptions = {}): Promise<Habit> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  const { data, error } = await client
    .from('habits')
    .upsert(habitToInsert(habit, userId), { onConflict: 'id' })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return habitRowToHabit(data)
}

export async function updateHabit(habit: Habit, options: RepositoryOptions = {}): Promise<Habit> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  const { data, error } = await client
    .from('habits')
    .update(habitToUpdate(habit))
    .eq('id', habit.id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return habitRowToHabit(data)
}

export async function deleteHabit(habitId: string, options: RepositoryOptions = {}): Promise<void> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  const { error } = await client
    .from('habits')
    .delete()
    .eq('id', habitId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

export async function upsertEntry(entry: HabitEntry, options: RepositoryOptions = {}): Promise<HabitEntry> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  const existing = await client
    .from('habit_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('habit_id', entry.habitId)
    .eq('date', entry.date)
    .maybeSingle()

  if (existing.error) throw new Error(existing.error.message)

  if (existing.data) {
    const { data, error } = await client
      .from('habit_entries')
      .update(entryToUpdate(entry))
      .eq('id', existing.data.id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return entryRowToHabitEntry(data)
  }

  const { data, error } = await client
    .from('habit_entries')
    .insert(entryToInsert(entry, userId))
    .select()
    .single()

  if (error) throw new Error(error.message)
  return entryRowToHabitEntry(data)
}

export async function upsertHabitEntry(entry: HabitEntry, options: RepositoryOptions = {}): Promise<HabitEntry> {
  return upsertEntry(entry, options)
}

export async function deleteEntry(entryId: string, options: RepositoryOptions = {}): Promise<void> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  const { error } = await client
    .from('habit_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

export async function deleteHabitEntry(entryId: string, options: RepositoryOptions = {}): Promise<void> {
  return deleteEntry(entryId, options)
}

export async function replaceAllUserDataFromImport(
  data: AppData,
  fileName: string | null,
  options: RepositoryOptions = {}
): Promise<AppData> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)

  await deleteRowsForUser(client, 'habit_entry_contexts', userId)
  await deleteRowsForUser(client, 'habit_entries', userId)
  await deleteRowsForUser(client, 'import_batches', userId)
  await deleteRowsForUser(client, 'habits', userId)
  await insertAppData(client, userId, data)
  await recordImportBatch(
    {
      fileName,
      habitsCount: data.habits.length,
      entriesCount: data.entries.length,
      metadata: { mode: 'replace' }
    },
    { client, userId }
  )

  return fetchAppData(userId, { client })
}

export async function appendUserDataFromImport(
  data: AppData,
  fileName: string | null,
  options: RepositoryOptions = {}
): Promise<AppData> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)

  await insertAppData(client, userId, data)
  await recordImportBatch(
    {
      fileName,
      habitsCount: data.habits.length,
      entriesCount: data.entries.length,
      metadata: { mode: 'append' }
    },
    { client, userId }
  )

  return fetchAppData(userId, { client })
}

export async function replaceAppData(data: AppData, options: RepositoryOptions = {}): Promise<AppData> {
  return replaceAllUserDataFromImport(data, null, options)
}

export async function exportableDataForUser(options: RepositoryOptions = {}): Promise<AppData> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  return fetchAppData(userId, { client })
}

export async function fetchEntryContexts(userId: string, options: RepositoryOptions = {}): Promise<HabitEntryContext[]> {
  const client = repositoryClient(options)
  const { data, error } = await client
    .from('habit_entry_contexts')
    .select('*')
    .eq('user_id', userId)
    .order('habit_id', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map(contextRowToHabitEntryContext)
}

export async function loadHabitEntryContexts(options: RepositoryOptions = {}): Promise<HabitEntryContext[]> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  return fetchEntryContexts(userId, { client })
}

export async function upsertEntryContext(
  context: HabitEntryContext,
  options: RepositoryOptions = {}
): Promise<HabitEntryContext> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  const { data, error } = await client
    .from('habit_entry_contexts')
    .upsert(contextToInsert(context, userId), { onConflict: 'entry_id' })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return contextRowToHabitEntryContext(data)
}

export async function upsertHabitEntryContext(
  context: HabitEntryContext,
  options: RepositoryOptions = {}
): Promise<HabitEntryContext> {
  return upsertEntryContext(context, options)
}

export async function deleteEntryContext(entryId: string, options: RepositoryOptions = {}): Promise<void> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  const { error } = await client
    .from('habit_entry_contexts')
    .delete()
    .eq('entry_id', entryId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

export async function deleteHabitEntryContext(entryId: string, options: RepositoryOptions = {}): Promise<void> {
  return deleteEntryContext(entryId, options)
}

export async function recordImportBatch(
  input: ImportBatchInput,
  options: RepositoryOptions = {}
): Promise<ImportBatchRow> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  const { data, error } = await client
    .from('import_batches')
    .insert({
      user_id: userId,
      source_app: input.sourceApp ?? 'loop_habit_tracker',
      file_name: input.fileName ?? null,
      habits_count: input.habitsCount,
      entries_count: input.entriesCount,
      metadata: input.metadata ?? {}
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

function repositoryClient(options: RepositoryOptions): Client {
  return options.client ?? supabase
}

async function repositoryUserId(client: Client, options: RepositoryOptions): Promise<string> {
  return options.userId ?? getCurrentUserId(client)
}

async function insertAppData(client: Client, userId: string, data: AppData): Promise<void> {
  for (const habits of chunks(data.habits, 500)) {
    const { error } = await client
      .from('habits')
      .insert(habits.map(habit => habitToInsert(habit, userId)))

    if (error) throw new Error(error.message)
  }

  for (const entries of chunks(data.entries, 1000)) {
    const { error } = await client
      .from('habit_entries')
      .insert(entries.map(entry => entryToInsert(entry, userId)))

    if (error) throw new Error(error.message)
  }

  for (const contexts of chunks(data.entryContexts, 1000)) {
    const { error } = await client
      .from('habit_entry_contexts')
      .insert(contexts.map(context => contextToInsert(context, userId)))

    if (error) throw new Error(error.message)
  }
}

async function deleteRowsForUser(
  client: Client,
  table: 'habit_entry_contexts' | 'habit_entries' | 'import_batches' | 'habits',
  userId: string
): Promise<void> {
  const { error } = await client.from(table).delete().eq('user_id', userId)
  if (error) throw new Error(error.message)
}

function sortData(data: AppData): AppData {
  return {
    habits: [...data.habits].sort((a, b) => a.position.localeCompare(b.position)),
    entries: [...data.entries].sort((a, b) => a.habitId.localeCompare(b.habitId) || b.date.localeCompare(a.date)),
    entryContexts: [...data.entryContexts].sort((a, b) => a.habitId.localeCompare(b.habitId) || a.entryId.localeCompare(b.entryId))
  }
}

function chunks<T>(values: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < values.length; i += size) {
    out.push(values.slice(i, i + size))
  }
  return out
}
