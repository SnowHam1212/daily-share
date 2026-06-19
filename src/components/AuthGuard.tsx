import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { LoadingSpinner } from './ui/LoadingSpinner'
import { LoginForm } from './Auth/LoginForm'
import { DisplayNameForm } from './Auth/DisplayNameForm.tsx'
import { TeamSetup } from './Auth/TeamSetup.tsx'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { loading, user, displayNameMissing, teams } = useAuth()

  if (loading) return <LoadingSpinner />

  if (!user) return <LoginForm />

  if (displayNameMissing) return <DisplayNameForm />

  if (!teams || teams.length === 0) return <TeamSetup />

  return <>{children}</>
}
