import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'

export function LoginForm() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const { error } = isSignUp
      ? await signUpWithEmail(email, password)
      : await signInWithEmail(email, password)
    if (error) setError(error.message)
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 24 }}>
      <h1>Daily Share</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
        <button type="submit">{isSignUp ? 'アカウント作成' : 'ログイン'}</button>
        <button type="button" onClick={() => signInWithGoogle()}>
          Google でログイン
        </button>
        <button type="button" onClick={() => setIsSignUp((v) => !v)}>
          {isSignUp ? 'ログインに切り替え' : 'アカウント作成に切り替え'}
        </button>
      </form>
    </div>
  )
}
