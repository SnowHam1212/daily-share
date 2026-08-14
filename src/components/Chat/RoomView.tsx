import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Flex,
  Text,
  HStack,
  Avatar,
  Input,
  IconButton,
  Spinner,
  Center,
  useToast,
  useDisclosure,
} from '@chakra-ui/react'
import { avatarColor } from '../../lib/avatarColor'
import { ArrowUpIcon, ArrowBackIcon } from '@chakra-ui/icons'
import { supabase } from '../../lib/supabase'
import { useTeamMembers } from '../../hooks/useTeamMembers'
import { RoomMembersModal } from './RoomMembersModal'
import { computeMessageFlags, formatDateLabel, formatTime } from './roomViewUtils'
import type { Database } from '../../types/database'

type MessageRow = Database['public']['Tables']['team_messages']['Row']
type Team = Database['public']['Tables']['teams']['Row']

// LINE を参考にした配色（このコンポーネント内でのみ使用）。
const CHAT_BG = '#8cabd8'
const MY_BUBBLE = '#8de055'
const SEND_GREEN = '#06c755'

interface RoomViewProps {
  team: Team
  currentUserId: string | undefined
  onBack: () => void
  /** 自分が退出したあとに呼ぶ（ルーム一覧へ戻す）。 */
  onLeft: () => void
}

export function RoomView({ team, currentUserId, onBack, onLeft }: RoomViewProps) {
  const toast = useToast()
  const teamId = team.id
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const membersDisclosure = useDisclosure()

  // 表示名は RPC 経由のメンバー一覧から引く（user_teams は自分の行しか見えないため）。
  // フックはここで1つだけ持ち、モーダルへ渡す。二重取得を避け、
  // モーダルでの招待・退出がヘッダー側の表示名にも即反映されるようにする。
  const memberState = useTeamMembers(teamId)
  const memberNames = useMemo(
    () => new Map(memberState.members.map((m) => [m.userId, m.displayName])),
    [memberState.members],
  )

  // 日付セパレータと連投グルーピングの判定（ロジックは roomViewUtils）。
  const messageFlags = useMemo(() => computeMessageFlags(messages), [messages])

  const fetchMessages = useCallback(async (tid: string) => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('team_messages')
        .select('*')
        .eq('teamId', tid)
        .order('createdAt', { ascending: true })
      setMessages(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchMessages(teamId)

    const channel = supabase
      .channel(`team_messages:${teamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_messages', filter: `teamId=eq.${teamId}` },
        (payload) => {
          setMessages((prev) => {
            const next = payload.new as MessageRow
            if (prev.some((m) => m.id === next.id)) return prev
            return [...prev, next]
          })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [teamId, fetchMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const nameOf = useCallback(
    (id: string) => (id === currentUserId ? 'あなた' : memberNames.get(id) ?? 'メンバー'),
    [memberNames, currentUserId],
  )

  async function handleSend() {
    const body = draft.trim()
    if (!body || !currentUserId) return
    setSending(true)
    try {
      const { error } = await supabase
        .from('team_messages')
        .insert({ teamId, userId: currentUserId, body })
      if (error) {
        console.error('send message error', error)
        toast({ status: 'error', title: '送信できませんでした', description: error.message })
        return
      }
      setDraft('')
      void fetchMessages(teamId)
    } finally {
      setSending(false)
    }
  }

  return (
    <Box borderRadius="xl" overflow="hidden" borderWidth="1px" borderColor="gray.200" bg="paper-2">
      {/* ルームヘッダー（戻る・ルーム名・メンバー管理） */}
      <HStack px={3} py={2.5} borderBottom="1px solid" borderColor="gray.200" bg="paper-2" spacing={2}>
        <IconButton aria-label="ルーム一覧に戻る" icon={<ArrowBackIcon />} variant="ghost" borderRadius="full" onClick={onBack} />
        <Text fontWeight="semibold" fontSize="md" color="gray.900" noOfLines={1} flex={1}>
          {team.teamName}
        </Text>
        <IconButton
          aria-label="メンバー管理"
          icon={<Box as="span">👥</Box>}
          variant="ghost"
          borderRadius="full"
          onClick={membersDisclosure.onOpen}
        />
      </HStack>

      <Box h="calc(100vh - 300px)" minH="320px" overflowY="auto" px={3} py={4} bg={CHAT_BG}>
        {loading ? (
          <Center h="100%">
            <Spinner color="white" thickness="3px" />
          </Center>
        ) : messages.length === 0 ? (
          <Center h="100%">
            <Text color="blackAlpha.600">まだメッセージがありません。最初の一言を送ってみましょう。</Text>
          </Center>
        ) : (
          <Box>
            {messages.map((m, i) => {
              const mine = m.userId === currentUserId
              const { showDate, startGroup } = messageFlags[i]
              const time = (
                <Text fontSize="10px" color="blackAlpha.600" flexShrink={0} pb="2px">
                  {formatTime(m.createdAt)}
                </Text>
              )
              return (
                <Box key={m.id}>
                  {showDate && (
                    <Center my={3}>
                      <Box bg="blackAlpha.300" color="white" fontSize="xs" px={3} py={0.5} borderRadius="full">
                        {formatDateLabel(m.createdAt)}
                      </Box>
                    </Center>
                  )}
                  <Flex
                    justify={mine ? 'flex-end' : 'flex-start'}
                    align="flex-end"
                    gap={2}
                    mt={startGroup && !showDate ? 3 : '2px'}
                  >
                    {!mine &&
                      (startGroup ? (
                        <Avatar size="sm" name={nameOf(m.userId)} bg={avatarColor(m.userId)} color="white" />
                      ) : (
                        <Box w="32px" flexShrink={0} />
                      ))}
                    {mine && time}
                    <Box maxW="72%">
                      {!mine && startGroup && (
                        <Text fontSize="xs" color="blackAlpha.700" mb={1} ml={1}>
                          {nameOf(m.userId)}
                        </Text>
                      )}
                      <Box
                        bg={mine ? MY_BUBBLE : 'white'}
                        color="gray.900"
                        px={3}
                        py={2}
                        borderRadius="18px"
                        borderTopRightRadius={mine && startGroup ? '4px' : '18px'}
                        borderTopLeftRadius={!mine && startGroup ? '4px' : '18px'}
                        boxShadow="sm"
                      >
                        <Text fontSize="sm" whiteSpace="pre-wrap" wordBreak="break-word">
                          {m.body}
                        </Text>
                      </Box>
                    </Box>
                    {!mine && time}
                  </Flex>
                </Box>
              )
            })}
            <div ref={bottomRef} />
          </Box>
        )}
      </Box>

      <HStack p={2.5} borderTop="1px solid" borderColor="gray.200" bg="white" spacing={2}>
        <Input
          placeholder="メッセージを入力"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          borderRadius="full"
          bg="gray.100"
          border="none"
          _focusVisible={{ bg: 'white', boxShadow: 'focus' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
        />
        <IconButton
          aria-label="送信"
          icon={<ArrowUpIcon />}
          isRound
          bg={SEND_GREEN}
          color="white"
          _hover={{ bg: '#05b34d' }}
          _active={{ bg: '#049f44' }}
          isLoading={sending}
          isDisabled={!draft.trim()}
          onClick={() => void handleSend()}
        />
      </HStack>

      {membersDisclosure.isOpen && (
        <RoomMembersModal
          isOpen
          onClose={membersDisclosure.onClose}
          teamName={team.teamName}
          invitationalCode={team.invitationalCode}
          removalPolicy={team.removalPolicy}
          currentUserId={currentUserId}
          team={memberState}
          onLeft={onLeft}
        />
      )}
    </Box>
  )
}
