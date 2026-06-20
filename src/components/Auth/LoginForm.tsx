import { useState } from 'react'
import {
  Box, VStack, Divider, Text, HStack, Flex
} from '@chakra-ui/react'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card } from '../ui/Card'

interface LoginFormProps {
  onSwitchToSignup?: () => void
}

export function LoginForm({ onSwitchToSignup }: LoginFormProps) {
  const { signInWithEmail, signInWithGoogle } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    const result = await signInWithEmail(email, password)
    setIsLoading(false)
    if (result.error) setError(result.error.message)
  }

  return (
    <Flex minH="100vh" align="center" justify="center" px={4}>
      <Card w="full" maxW="400px">
        <VStack spacing={6} align="stretch">
          <Box>
            <Text fontSize="2xl" fontWeight="medium" color="gray.900">
              Daily Share
            </Text>
            <Text fontSize="sm" color="gray.500" mt={1}>
              アカウントにログインしてください
            </Text>
          </Box>

          <VStack as="form" onSubmit={handleSubmit} spacing={4} align="stretch">
            {error && (
              <Box
                bg="danger.50"
                border="1px solid"
                borderColor="danger.200"
                borderRadius="md"
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
            <Button type="submit" isLoading={isLoading} w="full">
              ログイン
            </Button>
          </VStack>

          <HStack>
            <Divider />
            <Text fontSize="xs" color="gray.400" whiteSpace="nowrap">または</Text>
            <Divider />
          </HStack>

          <Button variant="secondary" w="full" onClick={() => signInWithGoogle()}>
            Google でログイン
          </Button>

          {onSwitchToSignup && (
            <Text textAlign="center" fontSize="sm" color="gray.500">
              アカウントをお持ちでないですか？
              {' '}
              <Box
                as="span"
                color="primary.400"
                cursor="pointer"
                fontWeight="medium"
                onClick={onSwitchToSignup}
              >
                新規登録
              </Box>
            </Text>
          )}
        </VStack>
      </Card>
    </Flex>
  )
}