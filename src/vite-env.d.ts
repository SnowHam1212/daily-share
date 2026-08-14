/// <reference types="vite/client" />

/**
 * ビルド時に vite.config.ts の `define` で埋め込まれる定数。
 * 値が無いビルド（ローカル開発など）では空文字列になる。
 */
declare const __SENTRY_RELEASE__: string
declare const __SENTRY_ENVIRONMENT__: string

/** `.env.local` / Vercel の Environment Variables で渡す実行時の設定。 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** 設定したときだけ Sentry が有効になる。未設定なら no-op。 */
  readonly VITE_SENTRY_DSN?: string
  /** 通常は不要（Vercel では commit SHA から自動で決まる）。 */
  readonly VITE_SENTRY_RELEASE?: string
  /** 通常は不要（Vercel では VERCEL_ENV から自動で決まる）。 */
  readonly VITE_SENTRY_ENVIRONMENT?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
