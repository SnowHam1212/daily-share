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
      // 作成と admin 登録を1トランザクションで行う RPC を使う（0019）。
      const { data, error } = await supabase.rpc('create_team', {
        p_team_name: teamName.trim(),
      })

      if (error) {
        setCreateError(error.message)
        return
      }

      setCreatedCode(data?.[0]?.invitational_code ?? null)
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
      // teams を直接検索してはいけない。teams_select（0001）は自分が所属する
      // チームしか返さないため、参加前は必ず 0 件になる。検索と参加をまとめて
      // 行う SECURITY DEFINER の RPC を使う（0015）。
      const { error } = await supabase.rpc('join_team_by_code', {
        code: invitationalCode.trim(),
      })

      if (error) {
        setJoinError(error.message)
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
