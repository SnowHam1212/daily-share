import { useState } from 'react'
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
  Select,
  IconButton,
  Spinner,
  Center,
  Divider,
  useClipboard,
  useToast,
} from '@chakra-ui/react'
import { avatarColor } from '../../lib/avatarColor'
import { CopyIcon, AddIcon, LinkIcon } from '@chakra-ui/icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useMyTeamInvitations } from '../../hooks/useMyTeamInvitations'
import { useTeamMembers } from '../../hooks/useTeamMembers'
import { buildInviteUrl } from '../../lib/inviteLink'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import type { Database } from '../../types/database'

type Team = Database['public']['Tables']['teams']['Row']

function InviteCode({ code }: { code: string }) {
  const { hasCopied, onCopy } = useClipboard(code)
  // リンクを渡せば、相手はタップするだけで参加できる（#100）。
  // コードの手入力より確実なので、リンクの方を主導線にする。
  const inviteUrl = buildInviteUrl(window.location.origin, code)
  const { hasCopied: linkCopied, onCopy: onCopyLink } = useClipboard(inviteUrl)

  return (
    <VStack align="stretch" spacing={2}>
      <HStack spacing={2}>
        <Button
          size="sm"
          variant="signal"
          leftIcon={<LinkIcon boxSize={3} />}
          onClick={onCopyLink}
          flexShrink={0}
        >
          {linkCopied ? 'コピーしました' : '招待リンクをコピー'}
        </Button>
      </HStack>
      <HStack spacing={2}>
        <Text fontSize="xs" color="gray.500" flexShrink={0}>
          コード
        </Text>
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
    </VStack>
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
  // user_teams を直接引いてはいけない。user_teams_select（0001）は自分の行しか
  // 返さないため、他のメンバーが見えない。SECURITY DEFINER の list_team_members
  // 経由で取得する（0012）。
  const { members, loading } = useTeamMembers(team.id)
  const [leaving, setLeaving] = useState(false)
  const toast = useToast()

  const myRole = members.find((m) => m.userId === currentUserId)?.role

  async function handleLeave() {
    if (!currentUserId) return
    setLeaving(true)
    try {
      // user_teams を直接消すと「最後の1人が抜けて孤児チームが残る」ため
      // 後片付けまで面倒を見る RPC を通す（0012）。
      const { error } = await supabase.rpc('leave_team', { p_team_id: team.id })
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
              <Avatar size="xs" name={m.displayName} bg={avatarColor(m.userId)} color="white" />
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

/**
 * 自分宛に届いているチーム招待。承諾するまでチームには参加しない。
 * 招待が無いときは何も描画しない。
 */
function InvitationsCard({ onAccepted }: { onAccepted: () => Promise<void> | void }) {
  const { invitations, loading, accept, decline } = useMyTeamInvitations()
  const [busyId, setBusyId] = useState<string | null>(null)
  const toast = useToast()

  if (loading || invitations.length === 0) return null

  async function handleAccept(invitationId: string, teamName: string) {
    setBusyId(invitationId)
    try {
      const { error } = await accept(invitationId)
      if (error) {
        toast({ status: 'error', title: '参加できませんでした', description: error })
        return
      }
      toast({ status: 'success', title: `「${teamName}」に参加しました` })
      await onAccepted()
    } finally {
      setBusyId(null)
    }
  }

  async function handleDecline(invitationId: string, teamName: string) {
    setBusyId(invitationId)
    try {
      const { error } = await decline(invitationId)
      if (error) {
        toast({ status: 'error', title: '操作できませんでした', description: error })
        return
      }
      toast({ status: 'info', title: `「${teamName}」の招待を辞退しました` })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <Heading size="sm" mb={3}>
        届いている招待（{invitations.length}）
      </Heading>
      <VStack align="stretch" spacing={3}>
        {invitations.map((inv) => (
          <HStack key={inv.invitationId} spacing={3} wrap="wrap">
            <Avatar size="sm" name={inv.teamName} bg={avatarColor(inv.teamId)} color="white" />
            <Box flex={1} minW="140px">
              <Text fontSize="sm" fontWeight="semibold" color="gray.900" noOfLines={1}>
                {inv.teamName}
              </Text>
              <Text fontSize="xs" color="gray.500" noOfLines={1}>
                {inv.inviterName} さんからの招待
              </Text>
            </Box>
            <HStack spacing={2} flexShrink={0}>
              <Button
                size="sm"
                variant="signal"
                isLoading={busyId === inv.invitationId}
                onClick={() => handleAccept(inv.invitationId, inv.teamName)}
              >
                参加する
              </Button>
              <Button
                size="sm"
                variant="ghost"
                isDisabled={busyId === inv.invitationId}
                onClick={() => handleDecline(inv.invitationId, inv.teamName)}
              >
                辞退
              </Button>
            </HStack>
          </HStack>
        ))}
      </VStack>
    </Card>
  )
}

export default function TeamsTab() {
  const { user, teams, refreshProfile } = useAuth()
  const toast = useToast()

  const [teamName, setTeamName] = useState('')
  const [removalPolicy, setRemovalPolicy] = useState('admin_only')
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
      // teams へ直接 INSERT してはいけない。.select() が生成する RETURNING は
      // SELECT ポリシーの影響を受けるが、作成の瞬間はまだメンバーではないため
      // 行が返らない。作成と admin 登録を1トランザクションで行う RPC を使う（0019）。
      const { data, error } = await supabase.rpc('create_team', {
        p_team_name: teamName.trim(),
        p_removal_policy: removalPolicy,
      })
      if (error) {
        toast({ status: 'error', title: 'チーム作成に失敗しました', description: error.message })
        return
      }
      const created = data?.[0]
      toast({ status: 'success', title: `「${created?.team_name ?? teamName.trim()}」を作成しました` })
      setTeamName('')
      setRemovalPolicy('admin_only')
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
      // teams を直接検索してはいけない。teams_select（0001）は自分が所属する
      // チームしか返さないため、参加前は必ず 0 件になる。検索と参加をまとめて
      // 行う SECURITY DEFINER の RPC を使う（0015）。
      const { data: joinedTeamId, error } = await supabase.rpc('join_team_by_code', {
        code: inviteCode.trim(),
      })
      if (error) {
        toast({ status: 'error', title: '参加できませんでした', description: error.message })
        return
      }
      const already = teams.some((t) => t.id === joinedTeamId)
      toast({
        status: already ? 'info' : 'success',
        title: already ? 'すでに参加しているチームです' : 'チームに参加しました',
      })
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

      <InvitationsCard onAccepted={refreshProfile} />

      <Stack direction={{ base: 'column', md: 'row' }} spacing={4}>
        <Card flex={1}>
          <Heading size="sm" mb={3}>
            新しいチームを作成
          </Heading>
          <VStack align="stretch" spacing={3}>
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
            <Box>
              <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="wide" mb={1}>
                メンバーを退出させられる人
              </Text>
              <Select
                size="sm"
                value={removalPolicy}
                onChange={(e) => setRemovalPolicy(e.target.value)}
              >
                <option value="admin_only">管理者のみ</option>
                <option value="anyone">メンバー全員</option>
                <option value="nobody">誰も退出させられない</option>
              </Select>
              <Text fontSize="xs" color="gray.400" mt={1}>
                作成後は変更できません。各自が自分で脱退することは、どの設定でもできます。
              </Text>
            </Box>
          </VStack>
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
