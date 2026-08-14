import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './hooks/useAuth'
import { initSentry } from './lib/sentry'
import { registerServiceWorker } from './lib/registerSW'

// 描画前にエラートラッキングを初期化（DSN 未設定なら no-op）。
initSentry()

// ホーム画面に置けるようにする（本番ビルドのみ）。
registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
