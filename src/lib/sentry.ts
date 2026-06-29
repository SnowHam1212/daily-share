import * as Sentry from '@sentry/react'

// 実行時の DSN。未設定（ローカル開発や DSN を登録していない環境）では
// Sentry を一切初期化せず no-op にする。これにより .env が無くても
// 開発・テストが妨げられない。
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined

/** Sentry が有効化されているか（DSN が設定されているか）。 */
export const sentryEnabled = Boolean(dsn)

/**
 * Sentry を初期化する。`main.tsx` で描画前に一度だけ呼ぶ。
 * 現状はエラー収集（未捕捉例外）のみ。パフォーマンス追跡・セッション
 * リプレイは未使用なので、対応する integration を読み込まずバンドルを
 * 最小限に保つ。将来有効化する場合は `integrations` と `tracesSampleRate`
 * を追加する。
 */
export function initSentry() {
  if (!dsn) return

  Sentry.init({
    dsn,
    // 'production' / 'development' など Vite のモードをそのまま使う。
    environment: import.meta.env.MODE,
    // どのデプロイで起きたかを紐付けるリリースタグ（任意）。
    // ビルド時に VITE_SENTRY_RELEASE（例: コミット SHA）を渡すと有効。
    release: (import.meta.env.VITE_SENTRY_RELEASE as string | undefined) || undefined,
    // メール等の PII を自動付与しない。ユーザー識別は setSentryUser で
    // 最小限（ID のみ）を明示的に送る。
    sendDefaultPii: false,
    // エラー収集のみ。トレースは無効（= 課金対象のパフォーマンス計測なし）。
    tracesSampleRate: 0,
  })
}

/**
 * 発生したエラーをどのユーザーのものか紐付ける。
 * プライバシー配慮のためメール等は送らず ID のみ。サインアウト時は
 * null を渡してクリアする。
 */
export function setSentryUser(userId: string | null) {
  if (!dsn) return
  Sentry.setUser(userId ? { id: userId } : null)
}
