import { ChakraProvider } from '@chakra-ui/react'
import theme from './theme/theme'
import { AuthGuard } from './components/AuthGuard'
import { LoginForm } from './components/Auth/LoginForm'
import { Map } from './components/Map/Map'
import { useAuth } from './hooks/useAuth'

function Inner() {
  const { user, signOut } = useAuth()

  if (!user) return <LoginForm />

  return <Map onSignOut={signOut} />
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
