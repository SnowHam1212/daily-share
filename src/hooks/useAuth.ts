import { useEffect, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type Profile = Database['public']['Tables']['users']['Row']
type Team = Database['public']['Tables']['teams']['Row']

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [teams, setTeams] = useState<Array<Team>>([])
  const [loading, setLoading] = useState(true)

  const fetchProfileAndTeams = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null)
      setTeams([])
      return
    }

    // fetch profile from `users` table (new schema)
    const { data: profileData, error: profileError } = await (supabase as any)
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('fetch profile error', profileError)
      setProfile(null)
    } else {
      setProfile(profileData ?? null)
    }

    // fetch user_teams rows, then load teams
    const { data: userTeamsData, error: utError } = await (supabase as any)
      .from('user_teams')
      .select('teamId')
      .eq('userId', userId)

    if (utError) {
      console.error('fetch user_teams error', utError)
      setTeams([])
    } else if (!userTeamsData || userTeamsData.length === 0) {
      setTeams([])
    } else {
      const teamIds = (userTeamsData as any[]).map((r) => r.teamId)
      const { data: teamsData, error: teamsError } = await (supabase as any)
        .from('teams')
        .select('*')
        .in('id', teamIds)

      if (teamsError) {
        console.error('fetch teams error', teamsError)
        setTeams([])
      } else {
        setTeams(teamsData ?? [])
      }
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      fetchProfileAndTeams(session?.user?.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      fetchProfileAndTeams(session?.user?.id)
    })

    return () => subscription.unsubscribe()
  }, [fetchProfileAndTeams])

  const signInWithEmail = (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUpWithEmail = (email: string, password: string) =>
    supabase.auth.signUp({ email, password })

  const signInWithGoogle = () => supabase.auth.signInWithOAuth({ provider: 'google' })

  const signOut = () => supabase.auth.signOut()

  const refreshProfile = async () => {
    await fetchProfileAndTeams(user?.id)
  }

  const displayNameMissing = !profile || !profile.displayName || profile.displayName.trim() === ''

  const updateProfile = (
    userId: string,
    values: {
      displayName: string
      firstName?: string | null
      familyName?: string | null
      phoneNumber?: string | null
      birthday?: string | null
    }
  ) =>
    (supabase as any)
      .from('users')
      .update(values)
      .eq('id', userId)

  return {
    user,
    session,
    profile,
    teams,
    loading,
    displayNameMissing,
    refreshProfile,
    updateProfile,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
  }
}
