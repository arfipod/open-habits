import { describe, expect, it, vi } from 'vitest'
import { getAuthRedirectUrl } from '../lib/supabase/authRedirect'
import { getSupabaseEnv } from '../lib/supabase/env'
import { loadSelectedHabitId, saveSelectedHabitId } from '../lib/storage'

function testEnv(values: Partial<ImportMetaEnv>): ImportMetaEnv {
  return values as ImportMetaEnv
}

describe('Supabase env parsing', () => {
  it('accepts only public frontend Supabase env values', () => {
    expect(getSupabaseEnv(testEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-key'
    }))).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'publishable-key'
    })
  })

  it('rejects missing or invalid frontend env values', () => {
    expect(() => getSupabaseEnv(testEnv({ VITE_SUPABASE_PUBLISHABLE_KEY: 'key' }))).toThrow('Missing VITE_SUPABASE_URL')
    expect(() => getSupabaseEnv(testEnv({ VITE_SUPABASE_URL: 'https://example.supabase.co' }))).toThrow('Missing VITE_SUPABASE_PUBLISHABLE_KEY')
    expect(() => getSupabaseEnv(testEnv({
      VITE_SUPABASE_URL: 'not a url',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'key'
    }))).toThrow('valid URL')
  })
})

describe('Supabase auth redirects', () => {
  it('uses the current app origin for magic links', () => {
    expect(getAuthRedirectUrl({
      origin: 'https://open-habits.vercel.app',
      hash: '#auth-callback',
      search: '?debug=true',
      pathname: '/habits'
    } as Location)).toBe('https://open-habits.vercel.app')
  })
})

describe('selected habit storage', () => {
  it('stores and clears harmless UI preference data', () => {
    saveSelectedHabitId('habit-read')
    expect(loadSelectedHabitId()).toBe('habit-read')

    saveSelectedHabitId(null)
    expect(loadSelectedHabitId()).toBeNull()
  })

  it('treats unavailable localStorage as best effort', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(loadSelectedHabitId()).toBeNull()
    expect(() => saveSelectedHabitId('habit-read')).not.toThrow()
    expect(() => saveSelectedHabitId(null)).not.toThrow()
  })
})
