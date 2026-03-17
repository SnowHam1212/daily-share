import { useAuth } from './hooks/useAuth'
import { LoginForm } from './components/Auth/LoginForm'
import { Map } from './components/Map/Map'

function App() {
  const { user, loading, signOut } = useAuth()

  if (loading) return <div style={{ padding: 24 }}>読み込み中...</div>

  if (!user) return <LoginForm />

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={signOut}
        style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000 }}
      >
        ログアウト
      </button>
      <Map />
    </div>
  )
}

export default App
