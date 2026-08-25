/**
 * 未読件数の集計（#110）。
 *
 * 画面から切り離してテストできるよう、純粋な関数としてここに置く
 * （roomListUtils と同じ方針）。
 */

export interface UnreadMessageLike {
  teamId: string
  userId: string
  createdAt: string | null
}

/**
 * teamId ごとの未読件数を数える。
 *
 * - 自分の投稿は数えない（送った本人にとって未読ではないため）
 * - `lastReadAt` が無いチームは「一度も開いていない」とみなし全件を未読とする
 * - `createdAt` が null の行は順序が決められないので数えない
 *
 * 0 件のチームはキーを持たない（呼び出し側は has/get の既定 0 で扱える）。
 */
export function countUnreadByTeam(
  messages: UnreadMessageLike[],
  lastReadByTeam: Map<string, string>,
  currentUserId: string | undefined,
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const m of messages) {
    if (!m.createdAt) continue
    if (currentUserId && m.userId === currentUserId) continue
    const lastRead = lastReadByTeam.get(m.teamId)
    // lastRead が無ければ全件が未読。あれば厳密に新しいものだけ。
    if (lastRead && Date.parse(m.createdAt) <= Date.parse(lastRead)) continue
    counts.set(m.teamId, (counts.get(m.teamId) ?? 0) + 1)
  }
  return counts
}

/** バッジに出す合計。 */
export function totalUnread(counts: Map<string, number>): number {
  let total = 0
  for (const n of counts.values()) total += n
  return total
}

/** 9 件を超えたら "9+" にする（NotificationBell と同じ見せ方）。 */
export function formatBadgeCount(n: number): string {
  return n > 9 ? '9+' : String(n)
}
