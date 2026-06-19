import { useState } from 'react'
import { Button, Input, VStack, Text } from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export function TeamSetup() {
  const { user, refreshProfile } = useAuth()
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!user) return
    if (!teamName || teamName.trim() === '') {
      setError('チーム名を入力してください')
      return
    }
    setLoading(true)
    try {
      const invitationalCode = Math.random().toString(36).slice(2, 8)
      const { data: teamData, error: teamError } = await (supabase as any)
        .from('teams')
        .insert([{ teamName: teamName.trim(), invitationalCode }])
        .select()
        .single()

      if (teamError || !teamData) {
        setError(teamError?.message ?? 'チーム作成に失敗しました')
        setLoading(false)
        return
      }

      const { error: utError } = await (supabase as any)
        .from('user_teams')
        .insert([{ userId: user.id, teamId: teamData.id, role: 'admin' }])

      if (utError) {
        setError(utError.message)
        setLoading(false)
        return
      }

      await refreshProfile()
    } catch (e: any) {
      setError(e?.message ?? String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <VStack spacing={4} p={6} maxW="480px" margin="0 auto">
      <Text fontSize="lg">チームを作成するか参加してください</Text>
      <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="チーム名" />
      {error && <Text color="red.500">{error}</Text>}
      <Button onClick={handleCreate} isLoading={loading} colorScheme="green">
        チーム作成
      </Button>
    </VStack>
  )
}
