import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface FriendRequestNotification {
  requestId: string
  requester: { id: string; displayName: string; email: string }
  createdAt: string | null
}

const POLL_MS = 30_000

/**
 * アプリ内通知。現状は「受け取ったフレンド申請」を扱う。
 * 起動中は定期ポーリング＋タブ復帰時に再取得して未読件数を更新する。
 * 将来 #50 で予定共有・位置共有などの通知も同じ仕組みに集約できる。
 */
export function useNotifications(userId: string | undefined) {
  const [friendRequests, setFriendRequests] = useState<FriendRequestNotification[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!userId) {
      setFriendRequests([])
      return
    }
    setLoading(true)
    try {
      const { data: reqs } = await supabase
        .from('friend_requests')
        .select('id, requesterId, createdAt')
        .eq('addresseeId', userId)
        .eq('status', 'pending')
        .order('createdAt', { ascending: false })

      const rows = reqs ?? []
      if (rows.length === 0) {
        setFriendRequests([])
        return
      }
      const ids = rows.map((r) => r.requesterId)
      const { data: users } = await supabase
        .from('users')
        .select('id, displayName, email')
        .in('id', ids)
      const byId = new Map((users ?? []).map((u) => [u.id, u]))

      setFriendRequests(
        rows.map((r) => ({
          requestId: r.id,
          createdAt: r.createdAt,
          requester: byId.get(r.requesterId) ?? {
            id: r.requesterId,
            displayName: '不明なユーザー',
            email: '',
          },
        })),
      )
    } finally {
      setLoading(false)
    }
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

  const unreadCount = friendRequests.length

  return { friendRequests, unreadCount, loading, refresh }
}
