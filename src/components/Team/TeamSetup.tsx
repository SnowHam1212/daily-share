import { useState } from 'react'
import {
  Button,
  Input,
  VStack,
  Text,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Stack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useClipboard,
} from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Database } from '../../types/database'

type TeamInsert = Database['public']['Tables']['teams']['Insert']
type UserTeamInsert = Database['public']['Tables']['user_teams']['Insert']

type JoinResult = {
  id: string
  teamName: string
  invitationalCode: string
  createdAt: string | null
}

export function TeamSetup() {
  const { user, refreshProfile } = useAuth()
  const [teamName, setTeamName] = useState('')
  const [invitationalCode, setInvitationalCode] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { hasCopied, onCopy } = useClipboard(createdCode ?? '')

  const handleCreateTeam = async () => {
    if (!user) return
    setCreateError(null)
    if (!teamName.trim()) {
      setCreateError('チーム名を入力してください')
      return
    }

    setIsCreating(true)
    try {
      const invitationalCodeValue = Math.random().toString(36).slice(2, 8)
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert([{ teamName: teamName.trim(), invitationalCode: invitationalCodeValue } as TeamInsert])
        .select()
        .single()

      if (teamError || !teamData) {
        setCreateError(teamError?.message ?? 'チーム作成に失敗しました')
        return
      }

      const { error: utError } = await supabase
        .from('user_teams')
        .insert([{ userId: user.id, teamId: teamData.id, role: 'admin' } as UserTeamInsert])

      if (utError) {
        setCreateError(utError.message)
        return
      }

      setCreatedCode(invitationalCodeValue)
      setIsModalOpen(true)
    } catch (error: unknown) {
      setCreateError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinTeam = async () => {
    if (!user) return
    setJoinError(null)
    if (!invitationalCode.trim()) {
      setJoinError('招待コードを入力してください')
      return
    }

    setIsJoining(true)
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('invitationalCode', invitationalCode.trim())
        .maybeSingle() as { data: JoinResult | null; error: { message: string } | null }

      if (teamError) {
        setJoinError(teamError.message)
        return
      }

      if (!teamData) {
        setJoinError('招待コードが存在しません')
        return
      }

      const { error: utError } = await supabase
        .from('user_teams')
        .insert([{ userId: user.id, teamId: teamData.id, role: 'member' } as UserTeamInsert])

      if (utError) {
        setJoinError(utError.message)
        return
      }

      await refreshProfile()
    } catch (error: unknown) {
      setJoinError(error instanceof Error ? error.message : String(error))
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <VStack spacing={6} p={6} maxW="560px" margin="0 auto">
      <Text fontSize="2xl" fontWeight="bold">
        チーム設定
      </Text>
      <Tabs variant="enclosed" colorScheme="blue" isFitted>
        <TabList>
          <Tab>新規作成</Tab>
          <Tab>招待コードで参加</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <Stack spacing={4}>
              <Text>チーム名を入力して新しいチームを作成します。</Text>
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="チーム名"
              />
              {createError && <Text color="red.500">{createError}</Text>}
              <Button onClick={handleCreateTeam} isLoading={isCreating} colorScheme="green">
                チーム作成
              </Button>
            </Stack>
          </TabPanel>

          <TabPanel>
            <Stack spacing={4}>
              <Text>招待コードを入力して既存チームに参加します。</Text>
              <Input
                value={invitationalCode}
                onChange={(e) => setInvitationalCode(e.target.value)}
                placeholder="招待コード"
              />
              {joinError && <Text color="red.500">{joinError}</Text>}
              <Button onClick={handleJoinTeam} isLoading={isJoining} colorScheme="blue">
                参加する
              </Button>
            </Stack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>招待コードが発行されました</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={3}>このコードをコピーして、参加したい人に共有してください。</Text>
            <Text fontSize="lg" fontWeight="bold" mb={2}>
              {createdCode}
            </Text>
            <Button onClick={onCopy} size="sm" mb={3}>
              {hasCopied ? 'コピーしました' : 'コピー'}
            </Button>
            <Text fontSize="sm" color="gray.500">
              このコードは新しいメンバーが「招待コードで参加」タブに入力するものです。
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button
              colorScheme="blue"
              mr={3}
              onClick={async () => {
                setIsModalOpen(false)
                await refreshProfile()
              }}
            >
              閉じる
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  )
}
