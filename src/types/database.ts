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
          removalPolicy: string
          createdAt: string | null
        }
        Insert: {
          id?: string
          teamName: string
          invitationalCode: string
          removalPolicy?: string
          createdAt?: string | null
        }
        Update: {
          id?: string
          teamName?: string
          invitationalCode?: string
          removalPolicy?: string
          createdAt?: string | null
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          id: string
          teamId: string
          inviterId: string
          inviteeId: string
          status: string
          createdAt: string | null
        }
        Insert: {
          id?: string
          teamId: string
          inviterId: string
          inviteeId: string
          status?: string
          createdAt?: string | null
        }
        Update: {
          id?: string
          teamId?: string
          inviterId?: string
          inviteeId?: string
          status?: string
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
          teamId: string | null
          name: string
          startAt: string
          endAt: string
          isAllDay: boolean
          eventLocation: string | null
          sharingState: 'private' | 'friends' | 'team'
          recurrence: 'none' | 'daily' | 'weekly' | 'monthly'
          recurrenceEndDate: string | null
          timezone: string | null
          externalUid: string | null
          externalSource: string | null
          createdAt: string | null
        }
        Insert: {
          id?: string
          createdBy: string
          teamId?: string | null
          name: string
          startAt: string
          endAt: string
          isAllDay?: boolean
          eventLocation?: string | null
          sharingState?: 'private' | 'friends' | 'team'
          recurrence?: 'none' | 'daily' | 'weekly' | 'monthly'
          recurrenceEndDate?: string | null
          timezone?: string | null
          externalUid?: string | null
          externalSource?: string | null
          createdAt?: string | null
        }
        Update: {
          id?: string
          createdBy?: string
          teamId?: string | null
          name?: string
          startAt?: string
          endAt?: string
          isAllDay?: boolean
          eventLocation?: string | null
          sharingState?: 'private' | 'friends' | 'team'
          recurrence?: 'none' | 'daily' | 'weekly' | 'monthly'
          recurrenceEndDate?: string | null
          timezone?: string | null
          externalUid?: string | null
          externalSource?: string | null
          createdAt?: string | null
        }
        Relationships: []
      }
      message_reads: {
        Row: {
          userId: string
          teamId: string
          lastReadAt: string
        }
        Insert: {
          userId: string
          teamId: string
          lastReadAt?: string
        }
        Update: {
          userId?: string
          teamId?: string
          lastReadAt?: string
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
      join_team_by_code: {
        Args: { code: string }
        Returns: string
      }
      get_public_profiles: {
        Args: { p_ids: string[] }
        Returns: { id: string; display_name: string }[]
      }
      search_users: {
        Args: { p_query: string }
        Returns: { id: string; display_name: string }[]
      }
      list_my_teammates: {
        Args: Record<string, never>
        Returns: { id: string; display_name: string }[]
      }
      create_team: {
        Args: { p_team_name: string; p_removal_policy?: string }
        Returns: { id: string; team_name: string; invitational_code: string }[]
      }
      list_team_members: {
        Args: { p_team_id: string }
        Returns: {
          user_id: string
          display_name: string
          role: string
          joined_at: string
        }[]
      }
      invite_team_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: undefined
      }
      list_my_team_invitations: {
        Args: Record<string, never>
        Returns: {
          invitation_id: string
          team_id: string
          team_name: string
          inviter_id: string
          inviter_name: string
          created_at: string
        }[]
      }
      list_team_invitations: {
        Args: { p_team_id: string }
        Returns: {
          invitation_id: string
          invitee_id: string
          invitee_name: string
          created_at: string
        }[]
      }
      accept_team_invitation: {
        Args: { p_invitation_id: string }
        Returns: string
      }
      decline_team_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      cancel_team_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      remove_team_member: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: undefined
      }
      leave_team: {
        Args: { p_team_id: string }
        Returns: undefined
      }
    }
    Enums: {
      sharing_state: 'private' | 'friends' | 'team'
    }
  }
}
