import { useState } from 'react'
import { Box, VStack, Text, Flex } from '@chakra-ui/react'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card } from '../ui/Card'
import { Wordmark } from '../ui/Wordmark'

// Shown after the user follows a password-recovery email link.
export function UpdatePasswordForm() {
  const { updatePassword, clearPasswordRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('パスワードは6文字以上にしてください。')
      return
    }
    if (password !== confirm) {
      setError('パスワードが一致しません。')
      return
    }
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    clearPasswordRecovery()
  }

  return (
    <Flex className="map-grid" minH="100vh" align="center" justify="center" bg="paper" px={4} py={10}>
      <VStack spacing={6} w="full" maxW="400px">
        <Wordmark size="lg" />
        <Card w="full" boxShadow="lg">
          <VStack as="form" onSubmit={handleSubmit} spacing={4} align="stretch">
            <Text fontWeight="semibold">新しいパスワードを設定</Text>
            {error && (
              <Box bg="danger.50" border="1px solid" borderColor="danger.200" borderRadius="lg" px={3} py={2}>
                <Text fontSize="sm" color="danger.600">{error}</Text>
              </Box>
            )}
            <Input
              label="新しいパスワード"
              id="new-password"
              type="password"
              placeholder="6文字以上"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Input
              label="新しいパスワード（確認）"
              id="confirm-password"
              type="password"
              placeholder="もう一度入力"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <Button type="submit" isLoading={loading} w="full">
              パスワードを更新
            </Button>
          </VStack>
        </Card>
      </VStack>
    </Flex>
  )
}
