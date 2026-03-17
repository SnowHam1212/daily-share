import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { LoadingSpinner } from './ui/LoadingSpinner'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { loading } = useAuth()

  if (loading) return <LoadingSpinner />

  return <>{children}</>
}
