import { ChakraProvider } from '@chakra-ui/react'
import theme from './theme/theme'
import { AuthGuard } from './components/AuthGuard'
import { Map } from './components/Map/Map'
import { useAuth } from './hooks/useAuth'

function App() {
  const { signOut } = useAuth()

  return (
    <ChakraProvider theme={theme}>
      <AuthGuard>
        <Map onSignOut={signOut} />
      </AuthGuard>
    </ChakraProvider>
  )
}

export default App
