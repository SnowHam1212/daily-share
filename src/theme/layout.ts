/**
 * スマホ表示（md 未満）で画面下に固定するナビゲーションの高さ。
 * セーフエリア（ホームバー）分は含まないので、下端に固定する要素は
 * `calc(${MOBILE_NAV_HEIGHT} + env(safe-area-inset-bottom) + 余白)` で逃がす。
 */
export const MOBILE_NAV_HEIGHT = '3.75rem'

/** 画面下に固定する要素を、下部ナビの上へ逃がすための bottom 値。 */
export function aboveMobileNav(gap = '1rem') {
  return `calc(${MOBILE_NAV_HEIGHT} + env(safe-area-inset-bottom) + ${gap})`
}
