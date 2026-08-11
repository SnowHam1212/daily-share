import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Flex, HStack, Text, Avatar, VStack } from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'

type Team = Database['public']['Tables']['teams']['Row']
type MessageRow = Database['public']['Tables']['team_messages']['Row']

interface Preview {
  body: string
  createdAt: string | null
  /** 並び替え用。createdAt を数値化したもの（欠損は 0）。 */
  time: number
}

/**
 * 一覧のプレビューを1クエリで賄うために読む件数の上限。
 *
 * チームごとに「最新1件」を引くと所属チーム数だけ往復が発生するため、
 * まとめて新しい順に取得し、クライアント側で teamId ごとの最新へ畳む。
 * team_messages は 30 日で自動削除される（migration 0004）ので実運用の
 * 総量は小さく、この上限で全ルームをカバーできる想定。
 *
 * 上限に達した場合、古いルームのプレビューだけ欠ける可能性がある
 * （ルーム自体は「まだメッセージがありません」として一覧に残る）。
 * 厳密にやるなら DISTINCT ON でチームごとの最新1件を返す RPC が要る。
 */
const PREVIEW_FETCH_LIMIT = 200

/** ルーム一覧の時刻表示（今日は時刻、それ以外は日付）。 */
function formatListTime(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  return sameDay
    ? d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
    : `${d.getMonth() + 1}/${d.getDate()}`
}

interface RoomListProps {
  teams: Team[]
  onSelect: (teamId: string) => void
}

export function RoomList({ teams, onSelect }: RoomListProps) {
  // teamId -> 最新メッセージ。
  const [previews, setPreviews] = useState<Map<string, Preview>>(new Map())

  // teams は毎レンダー新しい配列になりうるので、effect の依存には
  // 中身から作った安定なキーを使う。
  const teamIds = useMemo(() => teams.map((t) => t.id), [teams])
  const teamIdsKey = teamIds.join(',')

  // 新着が既存より新しいときだけ差し替える。取得と Realtime の
  // 到着順が前後しても、古い内容で上書きしないようにするため。
  const applyMessage = useCallback((row: Pick<MessageRow, 'teamId' | 'body' | 'createdAt'>) => {
    const time = row.createdAt ? Date.parse(row.createdAt) : 0
    setPreviews((prev) => {
      const current = prev.get(row.teamId)
      if (current && current.time >= time) return prev
      const next = new Map(prev)
      next.set(row.teamId, { body: row.body, createdAt: row.createdAt, time })
      return next
    })
  }, [])

  useEffect(() => {
    const ids = teamIdsKey ? teamIdsKey.split(',') : []
    // teams が空なら ChatTab 側が別画面を出すのでここは実質到達しない。
    // 取り残された preview は teams に無い teamId なので参照されない。
    if (ids.length === 0) return

    let cancelled = false

    // 所属チーム全体の最新メッセージを1クエリで取得し、teamId ごとに畳む。
    async function load() {
      const { data, error } = await supabase
        .from('team_messages')
        .select('teamId, body, createdAt')
        .in('teamId', ids)
        .order('createdAt', { ascending: false })
        .limit(PREVIEW_FETCH_LIMIT)

      if (cancelled) return
      if (error) {
        console.error('room list preview error', error)
        return
      }

      // 新しい順で来るので、各 teamId の最初の1件が最新。
      const map = new Map<string, Preview>()
      for (const row of data ?? []) {
        if (map.has(row.teamId)) continue
        map.set(row.teamId, {
          body: row.body,
          createdAt: row.createdAt,
          time: row.createdAt ? Date.parse(row.createdAt) : 0,
        })
      }
      setPreviews(map)
    }

    void load()

    // 一覧を開いている間の新着を反映する。RLS により所属チームの行しか
    // 配信されないが、teams の部分集合を表示する場合に備えて絞り込む。
    const channel = supabase
      .channel('room_list_previews')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_messages' },
        (payload) => {
          const row = payload.new as MessageRow
          if (!ids.includes(row.teamId)) return
          applyMessage(row)
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [teamIdsKey, applyMessage])

  // 動きのあったルームを上に。メッセージが無いルームは元の順序を保って末尾へ。
  const orderedTeams = useMemo(() => {
    const originalIndex = new Map(teams.map((t, i) => [t.id, i]))
    return [...teams].sort((a, b) => {
      const ta = previews.get(a.id)?.time ?? 0
      const tb = previews.get(b.id)?.time ?? 0
      if (ta !== tb) return tb - ta
      return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0)
    })
  }, [teams, previews])

  return (
    <VStack
      align="stretch"
      spacing={0}
      borderRadius="xl"
      overflow="hidden"
      borderWidth="1px"
      borderColor="gray.200"
      bg="paper-2"
    >
      {orderedTeams.map((t, i) => {
        const preview = previews.get(t.id)
        return (
          <HStack
            key={t.id}
            spacing={3}
            px={4}
            py={3}
            cursor="pointer"
            borderTop={i === 0 ? undefined : '1px solid'}
            borderColor="gray.100"
            _hover={{ bg: 'gray.50' }}
            onClick={() => onSelect(t.id)}
          >
            <Avatar name={t.teamName} bg="primary.500" color="white" />
            <Box flex={1} minW={0}>
              <Flex justify="space-between" align="baseline" gap={2}>
                <Text fontWeight="semibold" color="gray.900" noOfLines={1}>
                  {t.teamName}
                </Text>
                <Text fontSize="xs" color="gray.400" flexShrink={0}>
                  {formatListTime(preview?.createdAt ?? null)}
                </Text>
              </Flex>
              <Text fontSize="sm" color="gray.500" noOfLines={1}>
                {preview ? preview.body : 'まだメッセージがありません'}
              </Text>
            </Box>
          </HStack>
        )
      })}
    </VStack>
  )
}
