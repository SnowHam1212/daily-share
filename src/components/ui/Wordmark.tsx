import { HStack, Text, Box, type StackProps } from '@chakra-ui/react'

interface WordmarkProps extends StackProps {
  /** Render only the pin mark, without the "Daily Share" text. */
  markOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: { mark: 7, font: 'md', tracking: '-0.02em' },
  md: { mark: 9, font: 'xl', tracking: '-0.03em' },
  lg: { mark: 12, font: '3xl', tracking: '-0.03em' },
} as const

/**
 * Brand wordmark. The signature element of Daily Share: a map pin whose tip is
 * a live coral "presence" dot — the same coral used everywhere we mean "now".
 */
export function Wordmark({ markOnly = false, size = 'md', ...props }: WordmarkProps) {
  const s = sizes[size]
  return (
    <HStack spacing={2.5} align="center" {...props}>
      <Box position="relative" boxSize={`${s.mark * 4}px`} flexShrink={0}>
        <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
          <path
            d="M12 2.5c-4.4 0-8 3.4-8 7.7 0 5.4 6.9 11 7.2 11.2.5.4 1.1.4 1.6 0 .3-.2 7.2-5.8 7.2-11.2 0-4.3-3.6-7.7-8-7.7z"
            fill="none"
            stroke="var(--ocean)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
        <Box
          className="presence-dot"
          position="absolute"
          top="36%"
          left="50%"
          transform="translate(-50%, -50%)"
        />
      </Box>
      {!markOnly && (
        <Text
          as="span"
          fontFamily="heading"
          fontWeight="700"
          fontSize={s.font}
          letterSpacing={s.tracking}
          color="gray.900"
          lineHeight="1"
        >
          Daily{' '}
          <Box as="span" color="primary.600">
            Share
          </Box>
        </Text>
      )}
    </HStack>
  )
}
