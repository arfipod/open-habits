export interface SupabaseEnv {
  supabaseUrl: string
  supabasePublishableKey: string
}

export function getSupabaseEnv(env: ImportMetaEnv = import.meta.env): SupabaseEnv {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim()
  const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!supabaseUrl) {
    throw new Error('Missing VITE_SUPABASE_URL. Add it to .env.local before using Supabase.')
  }

  if (!supabasePublishableKey) {
    throw new Error('Missing VITE_SUPABASE_PUBLISHABLE_KEY. Add it to .env.local before using Supabase.')
  }

  try {
    new URL(supabaseUrl)
  } catch {
    throw new Error('VITE_SUPABASE_URL must be a valid URL.')
  }

  return { supabaseUrl, supabasePublishableKey }
}
