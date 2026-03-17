import { Box, type BoxProps } from '@chakra-ui/react'
import type { ReactNode } from 'react'

interface CardProps extends BoxProps {
  children: ReactNode
}

export function Card({ children, ...props }: CardProps) {
  return (
    <Box
      bg="white"
      borderRadius="xl"
      boxShadow="md"
      border="1px solid"
      borderColor="gray.200"
      p={6}
      {...props}
    >
      {children}
    </Box>
  )
}
