import { useEffect, useState } from 'react'
import { ChakraProvider } from '@chakra-ui/react'
import theme from './theme/theme'
import { supabase } from './lib/supabase'
import { AuthGuard } from './components/AuthGuard'
import { LoginForm } from './components/Auth/LoginForm'
import { SignupForm } from './components/Auth/SignupForm'
import { ProfileSetupModal } from './components/Auth/ProfileSetupModal'
import { Map } from './components/Map/Map'
import { useAuth } from './hooks/useAuth'
import { LoadingSpinner } from './components/ui/LoadingSpinner'

type AuthView = 'login' | 'signup'

function Inner() {
  const { user, signOut } = useAuth()
  const [authView, setAuthView] = useState<AuthView>('login')
  const [profileChecked, setProfileChecked] = useState(false)
  const [needsProfile, setNeedsProfile] = useState(false)

  useEffect(() => {
    if (!user) {
      setProfileChecked(false)
      setNeedsProfile(false)
      return
    }
    supabase
      .from('users')
      .select('displayName')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setNeedsProfile(!data?.displayName)
        setProfileChecked(true)
      })
  }, [user])

  if (!user) {
    if (authView === 'signup') {
      return <SignupForm onSwitchToLogin={() => setAuthView('login')} />
    }
    return <LoginForm onSwitchToSignup={() => setAuthView('signup')} />
  }

  if (!profileChecked) return <LoadingSpinner />

  return (
    <>
      <Map onSignOut={signOut} />
      <ProfileSetupModal
        isOpen={needsProfile}
        onComplete={() => setNeedsProfile(false)}
      />
    </>
  )
}

function App() {
  return (
    <ChakraProvider theme={theme}>
      <AuthGuard>
        <Inner />
      </AuthGuard>
    </ChakraProvider>
  )
}

export default App
