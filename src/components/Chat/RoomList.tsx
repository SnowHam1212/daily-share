import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Flex, HStack, Text, Avatar, VStack } from '@chakra-ui/react'
import { avatarColor } from '../../lib/avatarColor'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import { formatBadgeCount } from './unreadUtils'
import {
  foldLatestByTeam,
  formatListTime,
  orderTeamsByRecency,
  withNewerMessage,
  type Preview,
} from './roomListUtils'

type Team = Database['public']['Tables']['teams']['Row']
type MessageRow = Database['public']['Tables']['team_messages']['Row']

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

interface RoomListProps {
  teams: Team[]
  onSelect: (teamId: string) => void
  /** teamId -> 未読件数（#110）。MainLayout 側で数えたものを受け取る。 */
  unreadByTeam?: Map<string, number>
}

export function RoomList({ teams, onSelect, unreadByTeam }: RoomListProps) {
  // teamId -> 最新メッセージ。
  const [previews, setPreviews] = useState<Map<string, Preview>>(new Map())

  // teams は毎レンダー新しい配列になりうるので、effect の依存には
  // 中身から作った安定なキーを使う。
  const teamIdsKey = useMemo(() => teams.map((t) => t.id).join(','), [teams])

  const applyMessage = useCallback((row: MessageRow) => {
    setPreviews((prev) => withNewerMessage(prev, row))
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
      setPreviews(foldLatestByTeam(data ?? []))
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

  const orderedTeams = useMemo(() => orderTeamsByRecency(teams, previews), [teams, previews])

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
        const unread = unreadByTeam?.get(t.id) ?? 0
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
            <Avatar name={t.teamName} bg={avatarColor(t.id)} color="white" />
            <Box flex={1} minW={0}>
              <Flex justify="space-between" align="baseline" gap={2}>
                <Text fontWeight="semibold" color="gray.900" noOfLines={1}>
                  {t.teamName}
                </Text>
                <Text fontSize="xs" color="gray.400" flexShrink={0}>
                  {formatListTime(preview?.createdAt ?? null)}
                </Text>
              </Flex>
              <Flex justify="space-between" align="center" gap={2}>
                <Text
                  fontSize="sm"
                  color={unread > 0 ? 'gray.800' : 'gray.500'}
                  fontWeight={unread > 0 ? 'semibold' : undefined}
                  noOfLines={1}
                >
                  {preview ? preview.body : 'まだメッセージがありません'}
                </Text>
                {unread > 0 && (
                  <Box
                    as="span"
                    flexShrink={0}
                    minW="20px"
                    px="6px"
                    bg="danger.500"
                    color="white"
                    borderRadius="full"
                    fontSize="xs"
                    lineHeight="20px"
                    fontWeight="bold"
                    textAlign="center"
                    aria-label={`未読 ${unread} 件`}
                  >
                    {formatBadgeCount(unread)}
                  </Box>
                )}
              </Flex>
            </Box>
          </HStack>
        )
      })}
    </VStack>
  )
}
