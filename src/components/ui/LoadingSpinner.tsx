import { Flex, Spinner } from '@chakra-ui/react'

export function LoadingSpinner() {
  return (
    <Flex minH="100vh" align="center" justify="center">
      <Spinner size="xl" color="primary.400" thickness="4px" />
    </Flex>
  )
}
