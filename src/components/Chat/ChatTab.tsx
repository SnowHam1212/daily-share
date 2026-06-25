import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Flex,
  Heading,
  Text,
  HStack,
  VStack,
  Avatar,
  Input,
  IconButton,
  Select,
  Spinner,
  Center,
} from '@chakra-ui/react'
import { ArrowUpIcon } from '@chakra-ui/icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Card } from '../ui/Card'
import type { Database } from '../../types/database'

type MessageRow = Database['public']['Tables']['team_messages']['Row']

function formatStamp(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ChatTab() {
  const { user, teams } = useAuth()
  const [teamId, setTeamId] = useState<string | null>(teams[0]?.id ?? null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [memberNames, setMemberNames] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Keep a valid selected team as membership changes.
  useEffect(() => {
    if (teams.length === 0) {
      setTeamId(null)
    } else if (!teamId || !teams.some((t) => t.id === teamId)) {
      setTeamId(teams[0].id)
    }
  }, [teams, teamId])

  const fetchMembers = useCallback(async (tid: string) => {
    const { data: rows } = await supabase
      .from('user_teams')
      .select('userId')
      .eq('teamId', tid)
    const ids = Array.from(new Set((rows ?? []).map((r) => r.userId)))
    if (ids.length === 0) return setMemberNames(new Map())
    const { data: users } = await supabase
      .from('users')
      .select('id, displayName')
      .in('id', ids)
    setMemberNames(new Map((users ?? []).map((u) => [u.id, u.displayName])))
  }, [])

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

  // Load messages + members, and subscribe to live inserts for this team.
  useEffect(() => {
    if (!teamId) {
      setMessages([])
      return
    }
    void fetchMembers(teamId)
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
  }, [teamId, fetchMembers, fetchMessages])

  // Auto-scroll to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const nameOf = useCallback(
    (id: string) => (id === user?.id ? 'あなた' : memberNames.get(id) ?? 'メンバー'),
    [memberNames, user?.id],
  )

  async function handleSend() {
    const body = draft.trim()
    if (!body || !teamId || !user) return
    setSending(true)
    try {
      const { error } = await supabase
        .from('team_messages')
        .insert({ teamId, userId: user.id, body })
      if (error) {
        console.error('send message error', error)
        return
      }
      setDraft('')
      // Realtime will append, but refetch as a fallback if it doesn't arrive.
      void fetchMessages(teamId)
    } finally {
      setSending(false)
    }
  }

  const selectedTeamName = useMemo(
    () => teams.find((t) => t.id === teamId)?.teamName ?? '',
    [teams, teamId],
  )

  if (teams.length === 0) {
    return (
      <Card>
        <Text color="gray.500" textAlign="center" py={6}>
          チームに参加するとチャットが利用できます。「チーム」タブから作成・参加してください。
        </Text>
      </Card>
    )
  }

  return (
    <VStack align="stretch" spacing={4}>
      <Flex justify="space-between" align={{ base: 'stretch', md: 'center' }} direction={{ base: 'column', md: 'row' }} gap={3}>
        <Box>
          <Heading size="lg" letterSpacing="tight">
            チャット
          </Heading>
          <Text color="gray.600" mt={1}>
            {selectedTeamName} のメンバーとリアルタイムにやり取りできます。
          </Text>
        </Box>
        {teams.length > 1 && (
          <Box minW="200px">
            <Select value={teamId ?? ''} onChange={(e) => setTeamId(e.target.value)}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.teamName}
                </option>
              ))}
            </Select>
          </Box>
        )}
      </Flex>

      <Card p={0} overflow="hidden">
        <Box h="calc(100vh - 340px)" minH="320px" overflowY="auto" px={4} py={4}>
          {loading ? (
            <Center h="100%">
              <Spinner color="primary.500" thickness="3px" />
            </Center>
          ) : messages.length === 0 ? (
            <Center h="100%">
              <Text color="gray.400">まだメッセージがありません。最初の一言を送ってみましょう。</Text>
            </Center>
          ) : (
            <VStack align="stretch" spacing={3}>
              {messages.map((m) => {
                const mine = m.userId === user?.id
                return (
                  <Flex key={m.id} justify={mine ? 'flex-end' : 'flex-start'} gap={2}>
                    {!mine && <Avatar size="sm" name={nameOf(m.userId)} bg="primary.500" color="white" />}
                    <Box maxW="72%">
                      {!mine && (
                        <Text fontSize="xs" color="gray.500" mb={0.5} ml={1}>
                          {nameOf(m.userId)}
                        </Text>
                      )}
                      <Box
                        bg={mine ? 'primary.500' : 'gray.100'}
                        color={mine ? 'white' : 'gray.900'}
                        px={3}
                        py={2}
                        borderRadius="2xl"
                        borderTopRightRadius={mine ? 'sm' : '2xl'}
                        borderTopLeftRadius={mine ? '2xl' : 'sm'}
                      >
                        <Text fontSize="sm" whiteSpace="pre-wrap" wordBreak="break-word">
                          {m.body}
                        </Text>
                      </Box>
                      <Text fontSize="10px" color="gray.400" mt={0.5} textAlign={mine ? 'right' : 'left'}>
                        {formatStamp(m.createdAt)}
                      </Text>
                    </Box>
                  </Flex>
                )
              })}
              <div ref={bottomRef} />
            </VStack>
          )}
        </Box>

        <HStack p={3} borderTop="1px solid" borderColor="gray.200" bg="paper-2" spacing={2}>
          <Input
            placeholder="メッセージを入力"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
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
            colorScheme="primary"
            isLoading={sending}
            isDisabled={!draft.trim()}
            onClick={() => void handleSend()}
          />
        </HStack>
      </Card>
    </VStack>
  )
}
