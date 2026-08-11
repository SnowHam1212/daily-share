import { ChakraProvider } from '@chakra-ui/react'
import * as Sentry from '@sentry/react'
import theme from './theme/theme'
import { AuthGuard } from './components/AuthGuard'
import { MainLayout } from './components/Layout/MainLayout'
import { ErrorFallback } from './components/ErrorFallback'

function App() {
  return (
    <ChakraProvider theme={theme}>
      <Sentry.ErrorBoundary fallback={({ resetError }) => <ErrorFallback resetError={resetError} />}>
        <AuthGuard>
          <MainLayout />
        </AuthGuard>
      </Sentry.ErrorBoundary>
    </ChakraProvider>
  )
}

export default App
