/**
 * Service Worker の登録（#101）。
 *
 * 開発中は登録しない。dev サーバーは HMR で配信しており、SW が挟まると
 * 更新が反映されず原因の分かりにくい不具合になるため。
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  // 描画を妨げないよう load 後に登録する。
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      // 登録に失敗してもアプリは通常どおり動く（ホーム画面に置けないだけ）。
      console.error('service worker registration failed', error)
    })
  })
}
