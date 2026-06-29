import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface FriendRequestNotification {
  requestId: string
  requester: { id: string; displayName: string; email: string }
  createdAt: string | null
}

export interface EventNotification {
  eventId: string
  name: string
  startAt: string
  createdAt: string | null
  creator: { id: string; displayName: string }
  /** 最終閲覧時刻より後に作成された＝未読か。 */
  unread: boolean
}

const POLL_MS = 30_000
// 予定通知の対象は直近のみ（古い予定を延々と通知しない）。
const EVENT_LOOKBACK_DAYS = 30
const EVENT_LIMIT = 20

/** 予定通知の「最終閲覧時刻」を保存する localStorage キー。ユーザー単位。 */
function eventsSeenKey(userId: string) {
  return `notif:eventsLastSeen:${userId}`
}

function readEventsLastSeen(userId: string): string {
  const stored = localStorage.getItem(eventsSeenKey(userId))
  if (stored) return stored
  // 初回はその時点を基準にし、過去の予定で通知を溢れさせない
  // （以降に作成された予定だけを「新着」として扱う）。
  const now = new Date().toISOString()
  localStorage.setItem(eventsSeenKey(userId), now)
  return now
}

/**
 * アプリ内通知。受け取ったフレンド申請（actionable）に加え、自分の所属
 * チームで他人が作成した新しい予定（#50）を扱う。起動中は定期ポーリング＋
 * タブ復帰時に再取得して未読件数を更新する。
 *
 * 予定の「未読」は localStorage の最終閲覧時刻で判定する（DB スキーマ変更なし）。
 * フレンド申請は対応するまで常に未読扱い。
 */
export function useNotifications(userId: string | undefined) {
  const [friendRequests, setFriendRequests] = useState<FriendRequestNotification[]>([])
  // 取得済みの予定（未読フラグは lastSeen から都度算出する）。
  const [eventRows, setEventRows] = useState<Omit<EventNotification, 'unread'>[]>([])
  const [lastSeen, setLastSeen] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // refresh が lastSeen 変化で作り直されないよう ref で参照する。
  const lastSeenRef = useRef<string | null>(null)
  lastSeenRef.current = lastSeen

  const refresh = useCallback(async () => {
    if (!userId) {
      setFriendRequests([])
      setEventRows([])
      return
    }
    setLoading(true)
    try {
      const since = new Date(Date.now() - EVENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()

      // フレンド申請と新着予定を並行取得。
      const [{ data: reqs }, { data: evRows }] = await Promise.all([
        supabase
          .from('friend_requests')
          .select('id, requesterId, createdAt')
          .eq('addresseeId', userId)
          .eq('status', 'pending')
          .order('createdAt', { ascending: false }),
        // RLS の events_select により自分の所属チームの予定のみ返る。
        // 自分が作成したものは除外。
        supabase
          .from('events')
          .select('id, name, startAt, createdBy, createdAt')
          .neq('createdBy', userId)
          .gte('createdAt', since)
          .order('createdAt', { ascending: false })
          .limit(EVENT_LIMIT),
      ])

      const reqRows = reqs ?? []
      const events = evRows ?? []

      // 申請者・作成者の表示名をまとめて引く。
      const userIds = [
        ...reqRows.map((r) => r.requesterId),
        ...events.map((e) => e.createdBy),
      ]
      const uniqueIds = [...new Set(userIds)]
      const byId = new Map<string, { id: string; displayName: string; email: string }>()
      if (uniqueIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, displayName, email')
          .in('id', uniqueIds)
        for (const u of users ?? []) byId.set(u.id, u)
      }

      setFriendRequests(
        reqRows.map((r) => ({
          requestId: r.id,
          createdAt: r.createdAt,
          requester: byId.get(r.requesterId) ?? {
            id: r.requesterId,
            displayName: '不明なユーザー',
            email: '',
          },
        })),
      )

      setEventRows(
        events.map((e) => {
          const creator = byId.get(e.createdBy)
          return {
            eventId: e.id,
            name: e.name,
            startAt: e.startAt,
            createdAt: e.createdAt,
            creator: { id: e.createdBy, displayName: creator?.displayName ?? '不明なユーザー' },
          }
        }),
      )
    } finally {
      setLoading(false)
    }
  }, [userId])

  // userId 確定時に lastSeen を読み込む（初回は now を保存）。
  useEffect(() => {
    if (!userId) {
      setLastSeen(null)
      return
    }
    setLastSeen(readEventsLastSeen(userId))
  }, [userId])

  useEffect(() => {
    void refresh()
    const id = setInterval(() => void refresh(), POLL_MS)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  // 予定に未読フラグを付与。
  const events = useMemo<EventNotification[]>(
    () =>
      eventRows.map((e) => ({
        ...e,
        unread: Boolean(lastSeen && e.createdAt && e.createdAt > lastSeen),
      })),
    [eventRows, lastSeen],
  )

  const unreadEventCount = events.filter((e) => e.unread).length
  // 申請は常に未読扱い（対応するまで残る）。
  const unreadCount = friendRequests.length + unreadEventCount

  /** 予定通知を既読にする（ベルを開いた時などに呼ぶ）。 */
  const markEventsSeen = useCallback(() => {
    if (!userId) return
    const now = new Date().toISOString()
    localStorage.setItem(eventsSeenKey(userId), now)
    setLastSeen(now)
  }, [userId])

  return { friendRequests, events, unreadCount, unreadEventCount, loading, refresh, markEventsSeen }
}
