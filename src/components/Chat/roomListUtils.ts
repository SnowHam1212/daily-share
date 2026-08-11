/**
 * ルーム一覧（RoomList）の表示ロジック。
 *
 * 「最新のルームを上に出す」「まとめて取った行を teamId ごとの最新へ畳む」
 * は取得方法と並び替えが絡んで間違えやすいので、描画から切り離して
 * 純粋関数にしてある。
 */

/** 一覧に出す最新メッセージ。 */
export interface Preview {
  body: string
  createdAt: string | null
  /** 並び替え用。createdAt を数値化したもの（欠損は 0）。 */
  time: number
}

/** 畳み込みに必要な最小限の行の形。 */
export interface MessageRowLike {
  teamId: string
  body: string
  createdAt: string | null
}

/** 並び替えに必要な最小限のチームの形。 */
export interface TeamLike {
  id: string
}

/** ルーム一覧の時刻表示（今日は時刻、それ以外は日付）。 */
export function formatListTime(iso: string | null, now: Date = new Date()) {
  if (!iso) return ''
  const d = new Date(iso)
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  return sameDay
    ? d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
    : `${d.getMonth() + 1}/${d.getDate()}`
}

/** createdAt を並び替え用の数値にする（null や不正値は 0）。 */
export function previewTime(createdAt: string | null) {
  if (!createdAt) return 0
  const t = Date.parse(createdAt)
  return Number.isNaN(t) ? 0 : t
}

/**
 * 新しい順に並んだ行から、teamId ごとの最新1件を取り出す。
 * 各 teamId で最初に現れた行が最新、という前提に依存する。
 */
export function foldLatestByTeam(rows: MessageRowLike[]): Map<string, Preview> {
  const map = new Map<string, Preview>()
  for (const row of rows) {
    if (map.has(row.teamId)) continue
    map.set(row.teamId, {
      body: row.body,
      createdAt: row.createdAt,
      time: previewTime(row.createdAt),
    })
  }
  return map
}

/**
 * 動きのあったルームを上に並べる。
 * メッセージが無いルームは元の順序を保ったまま末尾へ置く。
 */
export function orderTeamsByRecency<T extends TeamLike>(
  teams: T[],
  previews: Map<string, Preview>,
): T[] {
  const originalIndex = new Map(teams.map((t, i) => [t.id, i]))
  return [...teams].sort((a, b) => {
    const ta = previews.get(a.id)?.time ?? 0
    const tb = previews.get(b.id)?.time ?? 0
    if (ta !== tb) return tb - ta
    return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0)
  })
}

/**
 * 新着を反映した preview マップを返す。
 * 取得と Realtime の到着順が前後しても古い内容で上書きしないよう、
 * 既存より新しいときだけ差し替える。変化が無ければ同じ参照を返す。
 */
export function withNewerMessage(
  previews: Map<string, Preview>,
  row: MessageRowLike,
): Map<string, Preview> {
  const time = previewTime(row.createdAt)
  const current = previews.get(row.teamId)
  if (current && current.time >= time) return previews
  const next = new Map(previews)
  next.set(row.teamId, { body: row.body, createdAt: row.createdAt, time })
  return next
}
