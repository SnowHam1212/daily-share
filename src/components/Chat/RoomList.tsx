import { useEffect, useState } from 'react'
import { Box, Flex, HStack, Text, Avatar, VStack } from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'

type Team = Database['public']['Tables']['teams']['Row']

interface Preview {
  body: string
  createdAt: string | null
}

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

  useEffect(() => {
    let cancelled = false
    async function load() {
      const entries = await Promise.all(
        teams.map(async (t) => {
          const { data } = await supabase
            .from('team_messages')
            .select('body, createdAt')
            .eq('teamId', t.id)
            .order('createdAt', { ascending: false })
            .limit(1)
          const row = data?.[0]
          return [t.id, row ? { body: row.body, createdAt: row.createdAt } : null] as const
        }),
      )
      if (cancelled) return
      const map = new Map<string, Preview>()
      for (const [id, p] of entries) if (p) map.set(id, p)
      setPreviews(map)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [teams])

  return (
    <VStack align="stretch" spacing={0} borderRadius="xl" overflow="hidden" borderWidth="1px" borderColor="gray.200" bg="paper-2">
      {teams.map((t, i) => {
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
