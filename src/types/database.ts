export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type SharingState = 'private' | 'friends' | 'team'

export interface Database {
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
          createdAt: string
        }
        Insert: {
          id: string
          displayName: string
          familyName?: string | null
          firstName?: string | null
          email: string
          phoneNumber?: string | null
          birthday?: string | null
          createdAt?: string
        }
        Update: {
          id?: string
          displayName?: string
          familyName?: string | null
          firstName?: string | null
          email?: string
          phoneNumber?: string | null
          birthday?: string | null
          createdAt?: string
        }
      }
      teams: {
        Row: {
          id: string
          teamName: string
          invitationalCode: string
          createdAt: string
        }
        Insert: {
          id?: string
          teamName: string
          invitationalCode: string
          createdAt?: string
        }
        Update: {
          id?: string
          teamName?: string
          invitationalCode?: string
          createdAt?: string
        }
      }
      user_teams: {
        Row: {
          id: string
          userId: string
          teamId: string
          role: string
          joinedAt: string
        }
        Insert: {
          id?: string
          userId: string
          teamId: string
          role?: string
          joinedAt?: string
        }
        Update: {
          id?: string
          userId?: string
          teamId?: string
          role?: string
          joinedAt?: string
        }
      }
      user_friends: {
        Row: {
          id: string
          userId: string
          friendId: string
          createdAt: string
        }
        Insert: {
          id?: string
          userId: string
          friendId: string
          createdAt?: string
        }
        Update: {
          id?: string
          userId?: string
          friendId?: string
          createdAt?: string
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
          sharingState: SharingState
          createdAt: string
        }
        Insert: {
          id?: string
          createdBy: string
          teamId: string
          name: string
          startAt: string
          endAt: string
          eventLocation?: string | null
          sharingState?: SharingState
          createdAt?: string
        }
        Update: {
          id?: string
          createdBy?: string
          teamId?: string
          name?: string
          startAt?: string
          endAt?: string
          eventLocation?: string | null
          sharingState?: SharingState
          createdAt?: string
        }
      }
      locations: {
        Row: {
          userId: string
          lat: number | null
          lng: number | null
          sharingState: SharingState
          updatedAt: string
        }
        Insert: {
          userId: string
          lat?: number | null
          lng?: number | null
          sharingState?: SharingState
          updatedAt?: string
        }
        Update: {
          userId?: string
          lat?: number | null
          lng?: number | null
          sharingState?: SharingState
          updatedAt?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      sharing_state: SharingState
    }
  }
}
