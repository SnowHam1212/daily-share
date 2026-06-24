import { useCallback, useEffect, useState } from 'react'
import {
  Box,
  Flex,
  Heading,
  Text,
  HStack,
  VStack,
  Stack,
  Badge,
  Avatar,
  Input,
  IconButton,
  Spinner,
  Center,
  Divider,
  useClipboard,
  useToast,
} from '@chakra-ui/react'
import { CopyIcon, AddIcon } from '@chakra-ui/icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import type { Database } from '../../types/database'

type Team = Database['public']['Tables']['teams']['Row']
type TeamInsert = Database['public']['Tables']['teams']['Insert']
type UserTeamInsert = Database['public']['Tables']['user_teams']['Insert']

type Member = {
  userId: string
  role: string
  displayName: string
}

function InviteCode({ code }: { code: string }) {
  const { hasCopied, onCopy } = useClipboard(code)
  return (
    <HStack spacing={2}>
      <Box
        fontFamily="mono"
        fontSize="sm"
        fontWeight="700"
        bg="gray.100"
        px={2}
        py={1}
        borderRadius="md"
        letterSpacing="wide"
      >
        {code}
      </Box>
      <IconButton
        aria-label="招待コードをコピー"
        icon={<CopyIcon />}
        size="sm"
        variant="ghost"
        onClick={onCopy}
      />
      {hasCopied && (
        <Text fontSize="xs" color="signal.600">
          コピーしました
        </Text>
      )}
    </HStack>
  )
}

function TeamCard({
  team,
  currentUserId,
  onLeft,
}: {
  team: Team
  currentUserId: string | undefined
  onLeft: () => void
}) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [leaving, setLeaving] = useState(false)
  const toast = useToast()

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    try {
      const { data: rows, error } = await supabase
        .from('user_teams')
        .select('userId, role')
        .eq('teamId', team.id)
      if (error || !rows) {
        setMembers([])
        return
      }
      const ids = rows.map((r) => r.userId)
      const { data: users } = await supabase
        .from('users')
        .select('id, displayName')
        .in('id', ids)
      const nameById = new Map((users ?? []).map((u) => [u.id, u.displayName]))
      setMembers(
        rows.map((r) => ({
          userId: r.userId,
          role: r.role,
          displayName: nameById.get(r.userId) ?? '不明なユーザー',
        })),
      )
    } finally {
      setLoading(false)
    }
  }, [team.id])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const myRole = members.find((m) => m.userId === currentUserId)?.role

  async function handleLeave() {
    if (!currentUserId) return
    setLeaving(true)
    try {
      const { error } = await supabase
        .from('user_teams')
        .delete()
        .eq('teamId', team.id)
        .eq('userId', currentUserId)
      if (error) {
        toast({ status: 'error', title: '脱退できませんでした', description: error.message })
        return
      }
      toast({ status: 'success', title: `「${team.teamName}」から脱退しました` })
      onLeft()
    } finally {
      setLeaving(false)
    }
  }

  return (
    <Card>
      <Flex justify="space-between" align="start" gap={3} mb={3} wrap="wrap">
        <Box>
          <Heading size="md" letterSpacing="tight">
            {team.teamName}
          </Heading>
          {myRole && (
            <Badge mt={1} colorScheme={myRole === 'admin' ? 'purple' : 'gray'}>
              {myRole === 'admin' ? '管理者' : 'メンバー'}
            </Badge>
          )}
        </Box>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleLeave}
          isLoading={leaving}
        >
          脱退
        </Button>
      </Flex>

      <Stack spacing={1} mb={4}>
        <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="wide">
          招待コード
        </Text>
        <InviteCode code={team.invitationalCode} />
      </Stack>

      <Divider mb={3} />

      <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="wide" mb={2}>
        メンバー（{members.length}）
      </Text>
      {loading ? (
        <Center py={4}>
          <Spinner size="sm" color="primary.500" />
        </Center>
      ) : (
        <VStack align="stretch" spacing={2}>
          {members.map((m) => (
            <HStack key={m.userId} spacing={3}>
              <Avatar size="xs" name={m.displayName} bg="primary.500" color="white" />
              <Text fontSize="sm" color="gray.800">
                {m.displayName}
                {m.userId === currentUserId && (
                  <Text as="span" color="gray.400">
                    {' '}
                    (あなた)
                  </Text>
                )}
              </Text>
              {m.role === 'admin' && (
                <Badge colorScheme="purple" fontSize="10px">
                  管理者
                </Badge>
              )}
            </HStack>
          ))}
        </VStack>
      )}
    </Card>
  )
}

export default function TeamsTab() {
  const { user, teams, refreshProfile } = useAuth()
  const toast = useToast()

  const [teamName, setTeamName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)

  async function handleCreate() {
    if (!user) return
    if (!teamName.trim()) {
      toast({ status: 'warning', title: 'チーム名を入力してください' })
      return
    }
    setCreating(true)
    try {
      const code = Math.random().toString(36).slice(2, 8)
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert([{ teamName: teamName.trim(), invitationalCode: code } as TeamInsert])
        .select()
        .single()
      if (teamError || !teamData) {
        toast({ status: 'error', title: 'チーム作成に失敗しました', description: teamError?.message })
        return
      }
      const { error: utError } = await supabase
        .from('user_teams')
        .insert([{ userId: user.id, teamId: teamData.id, role: 'admin' } as UserTeamInsert])
      if (utError) {
        toast({ status: 'error', title: 'メンバー登録に失敗しました', description: utError.message })
        return
      }
      toast({ status: 'success', title: `「${teamData.teamName}」を作成しました` })
      setTeamName('')
      await refreshProfile()
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin() {
    if (!user) return
    if (!inviteCode.trim()) {
      toast({ status: 'warning', title: '招待コードを入力してください' })
      return
    }
    setJoining(true)
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('invitationalCode', inviteCode.trim())
        .maybeSingle()
      if (teamError) {
        toast({ status: 'error', title: '検索に失敗しました', description: teamError.message })
        return
      }
      if (!teamData) {
        toast({ status: 'error', title: '招待コードが存在しません' })
        return
      }
      if (teams.some((t) => t.id === teamData.id)) {
        toast({ status: 'info', title: 'すでに参加しているチームです' })
        return
      }
      const { error: utError } = await supabase
        .from('user_teams')
        .insert([{ userId: user.id, teamId: teamData.id, role: 'member' } as UserTeamInsert])
      if (utError) {
        toast({ status: 'error', title: '参加に失敗しました', description: utError.message })
        return
      }
      toast({ status: 'success', title: `「${teamData.teamName}」に参加しました` })
      setInviteCode('')
      await refreshProfile()
    } finally {
      setJoining(false)
    }
  }

  return (
    <VStack align="stretch" spacing={6}>
      <Box>
        <Heading size="lg" letterSpacing="tight">
          チーム管理
        </Heading>
        <Text color="gray.600" mt={1}>
          所属チームの確認・作成・参加・脱退ができます。
        </Text>
      </Box>

      <Stack direction={{ base: 'column', md: 'row' }} spacing={4}>
        <Card flex={1}>
          <Heading size="sm" mb={3}>
            新しいチームを作成
          </Heading>
          <HStack>
            <Input
              placeholder="チーム名"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button
              variant="signal"
              leftIcon={<AddIcon boxSize={3} />}
              onClick={handleCreate}
              isLoading={creating}
              flexShrink={0}
            >
              作成
            </Button>
          </HStack>
        </Card>

        <Card flex={1}>
          <Heading size="sm" mb={3}>
            招待コードで参加
          </Heading>
          <HStack>
            <Input
              placeholder="招待コード"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            />
            <Button onClick={handleJoin} isLoading={joining} flexShrink={0}>
              参加
            </Button>
          </HStack>
        </Card>
      </Stack>

      <Box>
        <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="wide" mb={3}>
          所属チーム（{teams.length}）
        </Text>
        {teams.length === 0 ? (
          <Card>
            <Text color="gray.500" textAlign="center" py={4}>
              まだチームに参加していません。上のフォームから作成または参加してください。
            </Text>
          </Card>
        ) : (
          <Stack spacing={4}>
            {teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                currentUserId={user?.id}
                onLeft={refreshProfile}
              />
            ))}
          </Stack>
        )}
      </Box>
    </VStack>
  )
}
