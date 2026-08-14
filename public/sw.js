/**
 * Service Worker（#101）
 *
 * 目的はホーム画面に置けるようにすることと、オフラインでも殻が開くこと。
 * 凝ったオフライン対応はしない（データは Supabase 依存で、どのみち
 * 通信が無ければ中身は出ない）。
 *
 * キャッシュ方針は「古いコードが残り続けない」ことを最優先にしている。
 *
 *   - /assets/* … Vite が内容ハッシュ付きのファイル名を出すので、
 *                 同じ URL の中身は永久に変わらない。cache-first で安全。
 *   - HTML     … network-first。新しいデプロイを必ず拾う。
 *                 オフラインのときだけキャッシュへ落ちる。
 *   - それ以外  … 素通し。特に Supabase への通信は別オリジンなので
 *                 ここに来ないが、来ても触らない。
 *
 * workbox は使っていない。依存を増やさずに済むうえ、上の方針は
 * 単純で、キャッシュの取り違えを自分で確認できるため。
 */

// デプロイのたびに古いキャッシュを捨てるための版数。
// 方針を変えたときは必ず上げること。
const CACHE = 'daily-share-v1'

// オフライン時に最低限開くもの。
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      // 1つでも失敗すると install ごと失敗するので、握りつぶして先へ進める。
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // GET 以外と別オリジンには関与しない（Supabase の API 等）。
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // 内容ハッシュ付きのビルド成果物は中身が変わらないので cache-first。
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(request, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  // 画面遷移（HTML）は network-first。新しいデプロイを確実に拾う。
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put('/', copy))
          }
          return res
        })
        // オフラインのときだけキャッシュへ落ちる。
        .catch(() => caches.match('/').then((hit) => hit ?? Response.error())),
    )
  }
})
