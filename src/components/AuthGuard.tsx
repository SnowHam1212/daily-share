import { useState, type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { LoadingSpinner } from './ui/LoadingSpinner'
import { LoginForm } from './Auth/LoginForm'
import { SignupForm } from './Auth/SignupForm'
import { ProfileSetupModal } from './Auth/ProfileSetupModal'
import { UpdatePasswordForm } from './Auth/UpdatePasswordForm'

interface AuthGuardProps {
  children: ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { loading, user, displayNameMissing, passwordRecovery, refreshProfile } = useAuth()
  const [authView, setAuthView] = useState<'login' | 'signup'>('login')

  if (loading) return <LoadingSpinner />

  // パスワード再設定リンクから来た場合は、まず新パスワード設定を最優先で表示
  if (passwordRecovery && user) return <UpdatePasswordForm />

  if (!user) {
    if (authView === 'signup') {
      return <SignupForm onSwitchToLogin={() => setAuthView('login')} />
    }
    return <LoginForm onSwitchToSignup={() => setAuthView('signup')} />
  }

  if (displayNameMissing) return <ProfileSetupModal isOpen onComplete={refreshProfile} />

  // チーム作成は任意。未所属でも MainLayout へ進み、「チーム」タブから作成・参加できる。
  return <>{children}</>
}
