import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './hooks/useAuth'
import { initSentry } from './lib/sentry'
import { capturePendingInvite } from './hooks/usePendingInvite'

// 描画前にエラートラッキングを初期化（DSN 未設定なら no-op）。
initSentry()

// 招待リンク（/join/:code）で来た場合、描画前にコードを退避して URL を戻す。
// 描画後だと認証状態によってはリダイレクトが走り、コードを取り逃す。
capturePendingInvite()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
