import type { SupabaseClient } from '@supabase/supabase-js'
import type { AppData, Habit, HabitEntry } from '../../types'
import type {
  Database,
  HabitEntryContextInsert,
  HabitEntryContextRow,
  ImportBatchRow,
  Json
} from './database.types'
import { supabase } from './client'
import {
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

export type HabitEntryContextInput = Omit<HabitEntryContextInsert, 'user_id'>

export async function getCurrentUserId(client: Client = supabase): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Supabase user is not authenticated.')
  return data.user.id
}

export async function loadAppData(options: RepositoryOptions = {}): Promise<AppData> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)

  const [habitsResult, entriesResult] = await Promise.all([
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
      .order('date', { ascending: false })
  ])

  if (habitsResult.error) throw new Error(habitsResult.error.message)
  if (entriesResult.error) throw new Error(entriesResult.error.message)

  return {
    habits: (habitsResult.data ?? []).map(habitRowToHabit),
    entries: (entriesResult.data ?? []).map(entryRowToHabitEntry)
  }
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

export async function upsertHabitEntry(entry: HabitEntry, options: RepositoryOptions = {}): Promise<HabitEntry> {
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

export async function deleteHabitEntry(entryId: string, options: RepositoryOptions = {}): Promise<void> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  const { error } = await client
    .from('habit_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
}

export async function replaceAppData(data: AppData, options: RepositoryOptions = {}): Promise<AppData> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  const deleteResult = await client
    .from('habits')
    .delete()
    .eq('user_id', userId)

  if (deleteResult.error) throw new Error(deleteResult.error.message)

  if (data.habits.length) {
    const { error } = await client
      .from('habits')
      .insert(data.habits.map(habit => habitToInsert(habit, userId)))

    if (error) throw new Error(error.message)
  }

  if (data.entries.length) {
    const { error } = await client
      .from('habit_entries')
      .insert(data.entries.map(entry => entryToInsert(entry, userId)))

    if (error) throw new Error(error.message)
  }

  return loadAppData({ client, userId })
}

export async function loadHabitEntryContexts(options: RepositoryOptions = {}): Promise<HabitEntryContextRow[]> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  const { data, error } = await client
    .from('habit_entry_contexts')
    .select('*')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function upsertHabitEntryContext(
  context: HabitEntryContextInput,
  options: RepositoryOptions = {}
): Promise<HabitEntryContextRow> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  const { data, error } = await client
    .from('habit_entry_contexts')
    .upsert({ ...context, user_id: userId }, { onConflict: 'entry_id' })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteHabitEntryContext(entryId: string, options: RepositoryOptions = {}): Promise<void> {
  const client = repositoryClient(options)
  const userId = await repositoryUserId(client, options)
  const { error } = await client
    .from('habit_entry_contexts')
    .delete()
    .eq('entry_id', entryId)
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
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
