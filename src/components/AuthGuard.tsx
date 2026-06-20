import { useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { LoadingSpinner } from './ui/LoadingSpinner'
import { LoginForm } from './Auth/LoginForm'
import { SignupForm } from './Auth/SignupForm'
import { ProfileSetupModal } from './Auth/ProfileSetupModal'
import { TeamSetup } from './Team/TeamSetup'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { loading, user, displayNameMissing, teams, refreshProfile } = useAuth()
  const [authView, setAuthView] = useState<'login' | 'signup'>('login')

  if (loading) return <LoadingSpinner />

  if (!user) {
    if (authView === 'signup') {
      return <SignupForm onSwitchToLogin={() => setAuthView('login')} />
    }
    return <LoginForm onSwitchToSignup={() => setAuthView('signup')} />
  }

  if (displayNameMissing) return <ProfileSetupModal isOpen onComplete={refreshProfile} />

  if (!teams || teams.length === 0) return <TeamSetup />

  return <>{children}</>
}
