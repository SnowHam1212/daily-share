/**
 * アバターの背景色を、ユーザーごとに散らして見分けやすくする。
 *
 * 全員が同じ色（primary.500）だと一覧で誰が誰だか分からないため、
 * 識別子から決定的に色を選ぶ。同じ人はいつでも同じ色になり、
 * 端末やセッションが変わってもぶれない。
 *
 * ランダムではなく決定的にするのは、再描画のたびに色が変わると
 * かえって混乱するため。
 */

/**
 * 背景に使う色。テーマのトークンから、白文字が読める濃さのものを選んである。
 * 中間色（.400）だとコントラストが足りないので .500 以上を使う。
 */
const AVATAR_COLORS = [
  'primary.500',
  'signal.600',
  'teal.500',
  'purple.500',
  'pink.500',
  'cyan.600',
  'orange.500',
  'green.500',
] as const

/**
 * 文字列から安定したハッシュを作る。暗号用途ではなく、色を散らすためだけのもの。
 *
 * djb2 で畳んだあと、最後にビットを撹拌している（xorshift 系の finalizer）。
 * これが無いと下位ビットしか色の決定に効かず、UUID のように長くて似た
 * 文字列が並ぶと特定の色に偏る。実際、撹拌前は24人中17人が2色に集中した。
 */
function hashString(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = (Math.imul(hash, 33) ^ input.charCodeAt(i)) | 0
  }
  // avalanche: 上位ビットの差を下位へ広げる
  let h = hash | 0
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/**
 * 識別子に対応する背景色を返す。
 *
 * userId のような不変の値を渡すのが望ましい。表示名を渡すと、
 * 改名したときに色が変わる。
 */
export function avatarColor(seed: string | null | undefined): string {
  if (!seed) return 'gray.400'
  return AVATAR_COLORS[hashString(seed) % AVATAR_COLORS.length]
}

/** テスト・確認用に色数を公開する。 */
export const AVATAR_COLOR_COUNT = AVATAR_COLORS.length
