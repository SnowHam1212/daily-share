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
} from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { Database } from '../../types/database'

type TeamInsert = Database['public']['Tables']['teams']['Insert']
type UserTeamInsert = Database['public']['Tables']['user_teams']['Insert']

export function TeamSetup() {
  const { user, refreshProfile } = useAuth()
  const [teamName, setTeamName] = useState('')
  const [invitationalCode, setInvitationalCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!user) return
    if (!teamName || teamName.trim() === '') {
      setError('チーム名を入力してください')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const code = Math.random().toString(36).slice(2, 8)
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert([{ teamName: teamName.trim(), invitationalCode: code } as TeamInsert])
        .select()
        .single()

      if (teamError || !teamData) {
        setError(teamError?.message ?? 'チーム作成に失敗しました')
        setLoading(false)
        return
      }

      const { error: utError } = await supabase
        .from('user_teams')
        .insert([{ userId: user.id, teamId: teamData.id, role: 'admin' } as UserTeamInsert])

      if (utError) {
        setError(utError.message)
        setLoading(false)
        return
      }

      await refreshProfile()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!invitationalCode || invitationalCode.trim() === '') {
      setError('招待コードを入力してください')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { error: rpcError } = await supabase.rpc('join_team_by_code', {
        code: invitationalCode.trim(),
      })

      if (rpcError) {
        setError(rpcError.message)
        setLoading(false)
        return
      }

      await refreshProfile()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <VStack spacing={4} p={6} maxW="480px" margin="0 auto">
      <Text fontSize="lg">チームを作成するか参加してください</Text>

      <Tabs w="full" isFitted onChange={() => setError(null)}>
        <TabList>
          <Tab>チームを作成する</Tab>
          <Tab>招待コードで参加</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <VStack spacing={4}>
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="チーム名"
              />
              <Button onClick={handleCreate} isLoading={loading} colorScheme="green" w="full">
                チーム作成
              </Button>
            </VStack>
          </TabPanel>
          <TabPanel>
            <VStack spacing={4}>
              <Input
                value={invitationalCode}
                onChange={(e) => setInvitationalCode(e.target.value)}
                placeholder="招待コード"
              />
              <Button onClick={handleJoin} isLoading={loading} colorScheme="green" w="full">
                参加する
              </Button>
            </VStack>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {error && <Text color="red.500">{error}</Text>}
    </VStack>
  )
}
