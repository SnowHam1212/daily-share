import { ChakraProvider } from '@chakra-ui/react'
import theme from './theme/theme'
import { AuthGuard } from './components/AuthGuard'
import { MainLayout } from './components/Layout/MainLayout'

function App() {
  return (
    <ChakraProvider theme={theme}>
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    </ChakraProvider>
  )
}

export default App
