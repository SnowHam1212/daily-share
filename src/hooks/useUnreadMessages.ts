import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  countUnreadByTeam,
  totalUnread,
  type UnreadMessageLike,
} from '../components/Chat/unreadUtils'

/**
 * 未読メッセージ件数（#110）。
 *
 * **MainLayout 側に置くこと。** <Tabs isLazy> はタブを離れると ChatTab を
 * unmount するため、ChatTab の中で数えるとチャットタブを開いている間しか
 * 数えられず、バッジの意味が無くなる。
 *
 * 取得は RoomList と同じ「まとめて取ってクライアントで畳む」方式。
 * チームごとに件数を問い合わせると所属チーム数だけ往復が発生するため、
 * 新しい順にまとめて取得して teamId ごとに数える。team_messages は
 * 30 日で自動削除される（0004）ので総量は小さい。
 */
const FETCH_LIMIT = 300
const POLL_MS = 30_000

export function useUnreadMessages(userId: string | undefined, teamIds: string[]) {
  const [counts, setCounts] = useState<Map<string, number>>(new Map())

  // teams は毎レンダー新しい配列になりうるので、依存には安定なキーを使う。
  const teamIdsKey = useMemo(() => teamIds.join(','), [teamIds])
  // Realtime のハンドラから最新の refresh を呼ぶための箱。
  const refreshRef = useRef<() => void>(() => {})

  const refresh = useCallback(async () => {
    const ids = teamIdsKey ? teamIdsKey.split(',') : []
    if (!userId || ids.length === 0) {
      setCounts(new Map())
      return
    }

    const [readsRes, msgsRes] = await Promise.all([
      supabase.from('message_reads').select('teamId, lastReadAt').eq('userId', userId),
      supabase
        .from('team_messages')
        .select('teamId, userId, createdAt')
        .in('teamId', ids)
        .order('createdAt', { ascending: false })
        .limit(FETCH_LIMIT),
    ])

    if (readsRes.error || msgsRes.error) {
      console.error('unread fetch error', readsRes.error ?? msgsRes.error)
      return
    }

    const lastReadByTeam = new Map<string, string>()
    for (const r of readsRes.data ?? []) {
      if (r.lastReadAt) lastReadByTeam.set(r.teamId, r.lastReadAt)
    }
    setCounts(
      countUnreadByTeam((msgsRes.data ?? []) as UnreadMessageLike[], lastReadByTeam, userId),
    )
  }, [userId, teamIdsKey])

  useEffect(() => {
    refreshRef.current = () => void refresh()
  }, [refresh])

  /** ルームを開いたときに既読位置を進める。 */
  const markTeamRead = useCallback(
    async (teamId: string) => {
      if (!userId) return
      // 先に画面から消す。往復を待たせるとバッジが残って見える。
      setCounts((prev) => {
        if (!prev.has(teamId)) return prev
        const next = new Map(prev)
        next.delete(teamId)
        return next
      })
      const { error } = await supabase
        .from('message_reads')
        .upsert(
          { userId, teamId, lastReadAt: new Date().toISOString() },
          { onConflict: 'userId,teamId' },
        )
      if (error) {
        console.error('mark read error', error)
        // 保存できていないので数え直す（楽観更新を巻き戻す）。
        void refresh()
      }
    },
    [userId, refresh],
  )

  useEffect(() => {
    // 初回取得も ref 経由で呼ぶ。エフェクト本体から直接 refresh() を呼ぶと
    // 早期リターンの空クリアが同期 setState になり、cascading render を
    // 招く（react-hooks/set-state-in-effect）。
    refreshRef.current()
    const id = setInterval(() => refreshRef.current(), POLL_MS)
    const onFocus = () => refreshRef.current()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  // 新着を即座にバッジへ反映する。team_messages は Realtime 有効（0003）。
  useEffect(() => {
    if (!userId || !teamIdsKey) return
    const channel = supabase
      .channel('unread:team_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_messages' },
        () => refreshRef.current(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, teamIdsKey])

  return { unreadByTeam: counts, unreadTotal: totalUnread(counts), markTeamRead, refresh }
}
