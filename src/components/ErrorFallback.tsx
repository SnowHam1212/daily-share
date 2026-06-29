import { Box, Button, Heading, Text, VStack } from '@chakra-ui/react'

interface ErrorFallbackProps {
  /** Sentry.ErrorBoundary が渡す、境界をリセットして再描画を試みる関数。 */
  resetError: () => void
}

/**
 * 未捕捉エラーで描画が落ちた際に表示する画面。Sentry.ErrorBoundary の
 * fallback として使う。ChakraProvider の内側に置くこと（Chakra コンポーネントを使うため）。
 */
export function ErrorFallback({ resetError }: ErrorFallbackProps) {
  return (
    <Box
      minH="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={6}
    >
      <VStack spacing={4} textAlign="center" maxW="md">
        <Heading size="md" fontFamily="heading">
          問題が発生しました
        </Heading>
        <Text color="gray.600">
          予期しないエラーが発生しました。お手数ですが、もう一度お試しください。
          問題が続く場合はしばらくしてから再度アクセスしてください。
        </Text>
        <Button
          colorScheme="primary"
          onClick={() => {
            // まず境界をリセットして再描画を試み、ダメなら全体リロード。
            resetError()
            window.location.reload()
          }}
        >
          再読み込み
        </Button>
      </VStack>
    </Box>
  )
}
