// Auto-generate this file by running: npx supabase gen types typescript --project-id <your-project-id>
// For now, this is a placeholder that will be replaced once Supabase project is linked.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      locations: {
        Row: {
          id: string
          user_id: string
          latitude: number
          longitude: number
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          latitude: number
          longitude: number
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          latitude?: number
          longitude?: number
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
