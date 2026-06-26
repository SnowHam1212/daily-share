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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      friend_requests: {
        Row: {
          id: string
          requesterId: string
          addresseeId: string
          status: string
          createdAt: string | null
        }
        Insert: {
          id?: string
          requesterId: string
          addresseeId: string
          status?: string
          createdAt?: string | null
        }
        Update: {
          id?: string
          requesterId?: string
          addresseeId?: string
          status?: string
          createdAt?: string | null
        }
        Relationships: []
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
        Relationships: []
      }
      team_messages: {
        Row: {
          id: string
          teamId: string
          userId: string
          body: string
          createdAt: string | null
        }
        Insert: {
          id?: string
          teamId: string
          userId: string
          body: string
          createdAt?: string | null
        }
        Update: {
          id?: string
          teamId?: string
          userId?: string
          body?: string
          createdAt?: string | null
        }
        Relationships: []
      }
      events: {
        Row: {
          id: string
          createdBy: string
          teamId: string
          name: string
          startAt: string
          endAt: string
          isAllDay: boolean
          eventLocation: string | null
          sharingState: 'private' | 'friends' | 'team'
          recurrence: 'none' | 'daily' | 'weekly' | 'monthly'
          recurrenceEndDate: string | null
          createdAt: string | null
        }
        Insert: {
          id?: string
          createdBy: string
          teamId: string
          name: string
          startAt: string
          endAt: string
          isAllDay?: boolean
          eventLocation?: string | null
          sharingState?: 'private' | 'friends' | 'team'
          recurrence?: 'none' | 'daily' | 'weekly' | 'monthly'
          recurrenceEndDate?: string | null
          createdAt?: string | null
        }
        Update: {
          id?: string
          createdBy?: string
          teamId?: string
          name?: string
          startAt?: string
          endAt?: string
          isAllDay?: boolean
          eventLocation?: string | null
          sharingState?: 'private' | 'friends' | 'team'
          recurrence?: 'none' | 'daily' | 'weekly' | 'monthly'
          recurrenceEndDate?: string | null
          createdAt?: string | null
        }
        Relationships: []
      }
      locations: {
        Row: {
          userId: string
          lat: number | null
          lng: number | null
          sharingState: 'private' | 'friends' | 'team'
          sharedTeamIds: string[]
          updatedAt: string | null
        }
        Insert: {
          userId: string
          lat?: number | null
          lng?: number | null
          sharingState?: 'private' | 'friends' | 'team'
          sharedTeamIds?: string[]
          updatedAt?: string | null
        }
        Update: {
          userId?: string
          lat?: number | null
          lng?: number | null
          sharingState?: 'private' | 'friends' | 'team'
          sharedTeamIds?: string[]
          updatedAt?: string | null
        }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      accept_friend_request: {
        Args: { request_id: string }
        Returns: undefined
      }
      remove_friend: {
        Args: { other_id: string }
        Returns: undefined
      }
      delete_own_account: {
        Args: Record<string, never>
        Returns: undefined
      }
    }
    Enums: {
      sharing_state: 'private' | 'friends' | 'team'
    }
  }
}
