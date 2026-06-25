import { useState } from 'react'
import {
  Box, VStack, Divider, Text, HStack, Flex
} from '@chakra-ui/react'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card } from '../ui/Card'
import { Wordmark } from '../ui/Wordmark'

interface LoginFormProps {
  onSwitchToSignup?: () => void
}

export function LoginForm({ onSwitchToSignup }: LoginFormProps) {
  const { signInWithEmail, signInWithGoogle, sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetting, setResetting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    const result = await signInWithEmail(email, password)
    setIsLoading(false)
    if (result.error) setError(result.error.message)
  }

  const handleReset = async () => {
    setError(null)
    if (!email.trim()) {
      setError('パスワード再設定メールを送るには、メールアドレスを入力してください。')
      return
    }
    setResetting(true)
    const { error } = await sendPasswordReset(email.trim())
    setResetting(false)
    if (error) {
      setError(error.message)
      return
    }
    setResetSent(true)
  }

  return (
    <Flex
      className="map-grid"
      minH="100vh"
      align="center"
      justify="center"
      bg="paper"
      px={4}
      py={10}
    >
      <VStack spacing={6} w="full" maxW="400px">
        <VStack spacing={3} textAlign="center">
          <Wordmark size="lg" />
          <Text fontSize="sm" color="gray.500" maxW="xs">
            今いる場所と、これからの予定を、仲間と分かち合おう。
          </Text>
        </VStack>

        <Card w="full" boxShadow="lg">
          <VStack spacing={5} align="stretch">
            <VStack as="form" onSubmit={handleSubmit} spacing={4} align="stretch">
              {error && (
                <Box
                  bg="danger.50"
                  border="1px solid"
                  borderColor="danger.200"
                  borderRadius="lg"
                  px={3}
                  py={2}
                >
                  <Text fontSize="sm" color="danger.600">{error}</Text>
                </Box>
              )}
              <Input
                label="メールアドレス"
                id="email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                label="パスワード"
                id="password"
                type="password"
                placeholder="パスワードを入力"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" isLoading={isLoading} w="full" mt={1}>
                ログイン
              </Button>
              {resetSent ? (
                <Text fontSize="xs" color="success.600" textAlign="center">
                  パスワード再設定メールを送信しました。メールのリンクから設定してください。
                </Text>
              ) : (
                <Text
                  fontSize="xs"
                  color="primary.600"
                  textAlign="center"
                  cursor="pointer"
                  fontWeight="medium"
                  opacity={resetting ? 0.6 : 1}
                  onClick={() => !resetting && handleReset()}
                >
                  {resetting ? '送信中...' : 'パスワードをお忘れですか？'}
                </Text>
              )}
            </VStack>

            <HStack>
              <Divider borderColor="gray.200" />
              <Text fontSize="xs" color="gray.400" whiteSpace="nowrap">または</Text>
              <Divider borderColor="gray.200" />
            </HStack>

            <Button variant="secondary" w="full" onClick={() => signInWithGoogle()}>
              Google でログイン
            </Button>
          </VStack>
        </Card>

        {onSwitchToSignup && (
          <Text textAlign="center" fontSize="sm" color="gray.500">
            アカウントをお持ちでないですか？
            {' '}
            <Box
              as="span"
              color="primary.600"
              cursor="pointer"
              fontWeight="semibold"
              onClick={onSwitchToSignup}
            >
              新規登録
            </Box>
          </Text>
        )}
      </VStack>
    </Flex>
  )
}
