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

/**
 * 下部ナビを使う条件。
 *
 * 幅だけで判定すると**横向きのスマホで破綻する**。iPhone を横にすると
 * 844x390 のように「幅は md(48em=768px) を超えるが高さは 390px しかない」
 * 状態になり、下部ナビが消えてタブがヘッダー（画面の上）へ移動する。
 * 65px のヘッダーが画面高の 17% を占め、親指も届かない。
 *
 * そのため高さの条件を or で足し、低い画面では幅が広くても下部ナビを使う。
 * 30em(480px) は横向きスマホ（〜430px）を拾い、タブレット縦（1024px）や
 * 横向きタブレット（〜600px以上）は拾わない値。
 *
 * Chakra のレスポンシブ配列は幅しか見られないため、生のメディアクエリを
 * `sx` に渡して使う。
 */
export const COMPACT_NAV_QUERY = '@media (max-width: 47.9375em), (max-height: 29.9375em)'
