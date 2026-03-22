// Auto-generated from supabase/migrations/0001_init.sql
// Regenerate via: npx supabase gen types --lang=typescript --local > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          displayName: string
          familyName: string | null
          firstName: string | null
          email: string
          phoneNumber: string | null
          birthday: string | null
          createdAt: string | null
        }
        Insert: {
          id: string
          displayName: string
          familyName?: string | null
          firstName?: string | null
          email: string
          phoneNumber?: string | null
          birthday?: string | null
          createdAt?: string | null
        }
        Update: {
          id?: string
          displayName?: string
          familyName?: string | null
          firstName?: string | null
          email?: string
          phoneNumber?: string | null
          birthday?: string | null
          createdAt?: string | null
        }
      }
      teams: {
        Row: {
          id: string
          teamName: string
          invitationalCode: string
          createdAt: string | null
        }
        Insert: {
          id?: string
          teamName: string
          invitationalCode: string
          createdAt?: string | null
        }
        Update: {
          id?: string
          teamName?: string
          invitationalCode?: string
          createdAt?: string | null
        }
      }
      user_teams: {
        Row: {
          id: string
          userId: string
          teamId: string
          role: string
          joinedAt: string | null
        }
        Insert: {
          id?: string
          userId: string
          teamId: string
          role?: string
          joinedAt?: string | null
        }
        Update: {
          id?: string
          userId?: string
          teamId?: string
          role?: string
          joinedAt?: string | null
        }
      }
      user_friends: {
        Row: {
          id: string
          userId: string
          friendId: string
          createdAt: string | null
        }
        Insert: {
          id?: string
          userId: string
          friendId: string
          createdAt?: string | null
        }
        Update: {
          id?: string
          userId?: string
          friendId?: string
          createdAt?: string | null
        }
      }
      events: {
        Row: {
          id: string
          createdBy: string
          teamId: string
          name: string
          startAt: string
          endAt: string
          eventLocation: string | null
          sharingState: 'private' | 'friends' | 'team'
          createdAt: string | null
        }
        Insert: {
          id?: string
          createdBy: string
          teamId: string
          name: string
          startAt: string
          endAt: string
          eventLocation?: string | null
          sharingState?: 'private' | 'friends' | 'team'
          createdAt?: string | null
        }
        Update: {
          id?: string
          createdBy?: string
          teamId?: string
          name?: string
          startAt?: string
          endAt?: string
          eventLocation?: string | null
          sharingState?: 'private' | 'friends' | 'team'
          createdAt?: string | null
        }
      }
      locations: {
        Row: {
          userId: string
          lat: number | null
          lng: number | null
          sharingState: 'private' | 'friends' | 'team'
          updatedAt: string | null
        }
        Insert: {
          userId: string
          lat?: number | null
          lng?: number | null
          sharingState?: 'private' | 'friends' | 'team'
          updatedAt?: string | null
        }
        Update: {
          userId?: string
          lat?: number | null
          lng?: number | null
          sharingState?: 'private' | 'friends' | 'team'
          updatedAt?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      sharing_state: 'private' | 'friends' | 'team'
    }
  }
}
