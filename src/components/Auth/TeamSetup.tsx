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
      // 作成と admin 登録を1トランザクションで行う RPC を使う（0019）。
      const { error: rpcError } = await supabase.rpc('create_team', {
        p_team_name: teamName.trim(),
      })

      if (rpcError) {
        setError(rpcError.message)
        setLoading(false)
        return
      }

      await refreshProfile()
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message)
      } else {
        setError(String(e))
      }
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
