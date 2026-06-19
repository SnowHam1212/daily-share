import { useState } from 'react'
import { Button, Input, VStack, Text } from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

export function DisplayNameForm() {
  const { user, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!user) return
    if (!displayName || displayName.trim() === '') {
      setError('表示名を入力してください')
      return
    }
    setLoading(true)
    const { error: updateError } = await (supabase as any)
      .from('users')
      .update({ displayName: displayName.trim() })
      .eq('id', user.id)
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
    } else {
      setError(null)
      await refreshProfile()
    }
  }

  return (
    <VStack spacing={4} p={6} maxW="400px" margin="0 auto">
      <Text fontSize="lg">表示名を設定してください</Text>
      <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="表示名" />
      {error && <Text color="red.500">{error}</Text>}
      <Button onClick={handleSubmit} isLoading={loading} colorScheme="blue">
        保存
      </Button>
    </VStack>
  )
}
