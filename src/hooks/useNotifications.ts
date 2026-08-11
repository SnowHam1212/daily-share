import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchPublicProfiles } from '../lib/profiles'

export interface FriendRequestNotification {
  requestId: string
  // 他人について保持してよいのは公開情報（表示名）だけ（0018）。
  requester: { id: string; displayName: string }
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
      // 申請者の表示名は公開情報の RPC から引く（0018）。
      const names = await fetchPublicProfiles(rows.map((r) => r.requesterId))

      setFriendRequests(
        rows.map((r) => ({
          requestId: r.id,
          createdAt: r.createdAt,
          requester: {
            id: r.requesterId,
            displayName: names.get(r.requesterId) ?? '不明なユーザー',
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
