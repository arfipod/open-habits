export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type HabitTypeDb = 'YES_NO' | 'NUMERICAL'
export type TargetTypeDb = 'AT_LEAST' | 'AT_MOST'
export type EntryValueKindDb =
  | 'YES_MANUAL'
  | 'YES_AUTO'
  | 'NO'
  | 'SKIP'
  | 'UNKNOWN'
  | 'NUMERIC'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          display_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      habits: {
        Row: {
          id: string
          user_id: string
          position: string
          name: string
          type: HabitTypeDb
          question: string
          description: string
          frequency_numerator: number
          frequency_denominator: number
          color: string
          unit: string
          target_type: TargetTypeDb | null
          target_value: number | null
          archived: boolean
          source: string
          external_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          position: string
          name: string
          type: HabitTypeDb
          question?: string
          description?: string
          frequency_numerator: number
          frequency_denominator: number
          color?: string
          unit?: string
          target_type?: TargetTypeDb | null
          target_value?: number | null
          archived?: boolean
          source?: string
          external_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          position?: string
          name?: string
          type?: HabitTypeDb
          question?: string
          description?: string
          frequency_numerator?: number
          frequency_denominator?: number
          color?: string
          unit?: string
          target_type?: TargetTypeDb | null
          target_value?: number | null
          archived?: boolean
          source?: string
          external_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      habit_entries: {
        Row: {
          id: string
          user_id: string
          habit_id: string
          date: string
          value_kind: EntryValueKindDb
          numeric_value: number | null
          notes: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          habit_id: string
          date: string
          value_kind: EntryValueKindDb
          numeric_value?: number | null
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          habit_id?: string
          date?: string
          value_kind?: EntryValueKindDb
          numeric_value?: number | null
          notes?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      habit_entry_contexts: {
        Row: {
          id: string
          user_id: string
          habit_id: string
          entry_id: string
          occurred_at: string | null
          occurred_time: string | null
          location_text: string | null
          comment: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          habit_id: string
          entry_id: string
          occurred_at?: string | null
          occurred_time?: string | null
          location_text?: string | null
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          habit_id?: string
          entry_id?: string
          occurred_at?: string | null
          occurred_time?: string | null
          location_text?: string | null
          comment?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          id: string
          user_id: string
          source_app: string
          file_name: string | null
          habits_count: number
          entries_count: number
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          source_app?: string
          file_name?: string | null
          habits_count?: number
          entries_count?: number
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          source_app?: string
          file_name?: string | null
          habits_count?: number
          entries_count?: number
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      handle_new_user: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
      set_updated_at: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type HabitRow = Database['public']['Tables']['habits']['Row']
export type HabitInsert = Database['public']['Tables']['habits']['Insert']
export type HabitUpdate = Database['public']['Tables']['habits']['Update']

export type HabitEntryRow = Database['public']['Tables']['habit_entries']['Row']
export type HabitEntryInsert = Database['public']['Tables']['habit_entries']['Insert']
export type HabitEntryUpdate = Database['public']['Tables']['habit_entries']['Update']

export type HabitEntryContextRow = Database['public']['Tables']['habit_entry_contexts']['Row']
export type HabitEntryContextInsert = Database['public']['Tables']['habit_entry_contexts']['Insert']
export type HabitEntryContextUpdate = Database['public']['Tables']['habit_entry_contexts']['Update']

export type ImportBatchRow = Database['public']['Tables']['import_batches']['Row']
export type ImportBatchInsert = Database['public']['Tables']['import_batches']['Insert']
export type ImportBatchUpdate = Database['public']['Tables']['import_batches']['Update']
