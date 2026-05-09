import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { getSupabaseEnv } from './env'

const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv()

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true
  }
})
