/**
 * トークルーム（RoomView）の表示ロジック。
 *
 * 日付セパレータの位置や連投のまとめ方は、境界（日跨ぎ・話者交代・
 * 先頭）で間違えやすい割に見た目からは気づきにくいので、描画から
 * 切り離して純粋関数にしてある。
 */

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** 同じ暦日か（閲覧者のローカルタイムゾーンで判定）。 */
export function isSameDay(a: string | null, b: string | null) {
  if (!a || !b) return false
  const da = new Date(a)
  const db = new Date(b)
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  )
}

/** 日付セパレータの見出し（例: 8月11日(火)）。 */
export function formatDateLabel(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`
}

/** 吹き出し脇の時刻（24時間表記）。 */
export function formatTime(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

/**
 * 「最下部付近にいる」とみなす余白（px）。
 * ぴったり最下部でなくても追従してほしいので、少し余裕を持たせる。
 */
export const BOTTOM_THRESHOLD_PX = 80

/**
 * スクロール位置が最下部付近かどうか。
 *
 * 新着メッセージで自動スクロールしてよいかの判定に使う。
 * 過去を遡って読んでいる最中に最下部へ飛ばされると読書が中断されるため、
 * 最下部付近にいるときだけ追従する。
 */
export function isNearBottom(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  threshold: number = BOTTOM_THRESHOLD_PX,
) {
  // 内容が画面に収まりきる場合（スクロールできない場合）は残り距離が
  // 0 以下になるため、この式だけで「最下部にいる」と判定される。
  return scrollHeight - (scrollTop + clientHeight) <= threshold
}

/** フラグ計算に必要な最小限のメッセージ形。 */
export interface MessageLike {
  userId: string
  createdAt: string | null
}

export interface MessageFlags {
  /** この行の前に日付セパレータを出すか。 */
  showDate: boolean
  /** 連投のかたまりの先頭か（アバターと名前を出す位置）。 */
  startGroup: boolean
}

/**
 * 各メッセージの表示フラグをまとめて計算する。
 * messages は古い順に並んでいる前提。
 *
 * - 日付が変わったらセパレータを出す（先頭は必ず出す）
 * - 話者が変わったか、日付が変わったらグループの先頭にする
 *   （日跨ぎで同じ人が続く場合も、セパレータの直後は先頭扱いにする）
 */
export function computeMessageFlags(messages: MessageLike[]): MessageFlags[] {
  return messages.map((m, i) => {
    const prev = messages[i - 1]
    const showDate = !prev || !isSameDay(prev.createdAt, m.createdAt)
    const startGroup = showDate || prev.userId !== m.userId
    return { showDate, startGroup }
  })
}
