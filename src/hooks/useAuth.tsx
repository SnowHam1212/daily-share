import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type Profile = Database['public']['Tables']['users']['Row']
type Team = Database['public']['Tables']['teams']['Row']
type UserTeamId = Pick<Database['public']['Tables']['user_teams']['Row'], 'teamId'>

type UserUpdate = Database['public']['Tables']['users']['Update']

type AuthResponse = { data: { user: User | null; session: Session | null }; error: AuthError | null }
type SignOutResponse = { error: AuthError | null }
type OAuthResponse = { data: { provider: string; url: string | null }; error: AuthError | null }
type DatabaseResponse<T> = { data: T | null; error: { message: string } | null }

type AuthContextValue = {
  user: User | null
  session: Session | null
  profile: Profile | null
  teams: Array<Team>
  loading: boolean
  displayNameMissing: boolean
  refreshProfile: () => Promise<void>
  updateProfile: (userId: string, values: UserUpdate) => Promise<DatabaseResponse<Profile>>
  signInWithEmail: (email: string, password: string) => Promise<AuthResponse>
  signUpWithEmail: (email: string, password: string) => Promise<AuthResponse>
  signInWithGoogle: () => Promise<OAuthResponse>
  signOut: () => Promise<SignOutResponse>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function useProvideAuth() {
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

    const { data: profileData, error: profileError } = await supabase
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

    const { data: userTeamsData, error: utError } = await supabase
      .from('user_teams')
      .select('teamId')
      .eq('userId', userId)

    if (utError) {
      console.error('fetch user_teams error', utError)
      setTeams([])
    } else if (!userTeamsData || userTeamsData.length === 0) {
      setTeams([])
    } else {
      const teamIds = (userTeamsData as UserTeamId[]).map((r) => r.teamId)
      const { data: teamsData, error: teamsError } = await supabase
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

  const signInWithEmail = async (email: string, password: string) =>
    await supabase.auth.signInWithPassword({ email, password })

  const signUpWithEmail = async (email: string, password: string) =>
    await supabase.auth.signUp({ email, password })

  const signInWithGoogle = async () =>
    await supabase.auth.signInWithOAuth({ provider: 'google' })

  const signOut = async () => await supabase.auth.signOut()

  const updateProfile = async (userId: string, values: UserUpdate) =>
    await supabase.from('users').update(values).eq('id', userId).select().single()

  const refreshProfile = async () => {
    await fetchProfileAndTeams(user?.id)
  }

  const displayNameMissing = !profile || !profile.displayName || profile.displayName.trim() === ''

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useProvideAuth()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
