import { useState } from 'react'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  Box,
  Button,
  IconButton,
  HStack,
  VStack,
  Text,
  Avatar,
  Badge,
  Center,
  useToast,
} from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'
import { useNotifications } from '../../hooks/useNotifications'

export function NotificationBell({ userId }: { userId: string | undefined }) {
  const { friendRequests, unreadCount, refresh } = useNotifications(userId)
  const toast = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function accept(requestId: string, name: string) {
    setBusyId(requestId)
    try {
      const { error } = await supabase.rpc('accept_friend_request', { request_id: requestId })
      if (error) {
        toast({ status: 'error', title: '承認できませんでした', description: error.message })
        return
      }
      toast({ status: 'success', title: `${name} と友だちになりました` })
      await refresh()
    } finally {
      setBusyId(null)
    }
  }

  async function decline(requestId: string) {
    setBusyId(requestId)
    try {
      await supabase.from('friend_requests').delete().eq('id', requestId)
      await refresh()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Popover placement="bottom-end" isLazy>
      <PopoverTrigger>
        <Box position="relative" display="inline-flex">
          <IconButton
            aria-label="通知"
            variant="ghost"
            borderRadius="full"
            fontSize="lg"
            icon={<Box as="span">🔔</Box>}
          />
          {unreadCount > 0 && (
            <Badge
              position="absolute"
              top={1}
              right={1}
              minW="18px"
              h="18px"
              px={1}
              borderRadius="full"
              bg="danger.500"
              color="white"
              fontSize="10px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              pointerEvents="none"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Box>
      </PopoverTrigger>
      <PopoverContent borderRadius="xl" borderColor="gray.200" boxShadow="lg" w="320px" _focus={{ outline: 'none' }}>
        <PopoverHeader fontWeight="semibold" borderColor="gray.100">
          通知
        </PopoverHeader>
        <PopoverBody px={2} py={2} maxH="360px" overflowY="auto">
          {friendRequests.length === 0 ? (
            <Center py={8}>
              <Text fontSize="sm" color="gray.500">
                新しい通知はありません
              </Text>
            </Center>
          ) : (
            <VStack align="stretch" spacing={1}>
              {friendRequests.map((n) => (
                <Box key={n.requestId} px={2} py={2} borderRadius="md" _hover={{ bg: 'gray.50' }}>
                  <HStack spacing={3} align="start">
                    <Avatar size="sm" name={n.requester.displayName} bg="primary.500" color="white" />
                    <Box minW={0} flex={1}>
                      <Text fontSize="sm" color="gray.800">
                        <Text as="span" fontWeight="600">
                          {n.requester.displayName}
                        </Text>{' '}
                        さんからフレンド申請
                      </Text>
                      <HStack spacing={2} mt={2}>
                        <Button
                          size="xs"
                          variant="signal"
                          isLoading={busyId === n.requestId}
                          onClick={() => accept(n.requestId, n.requester.displayName)}
                        >
                          承認
                        </Button>
                        <Button
                          size="xs"
                          variant="secondary"
                          isDisabled={busyId === n.requestId}
                          onClick={() => decline(n.requestId)}
                        >
                          拒否
                        </Button>
                      </HStack>
                    </Box>
                  </HStack>
                </Box>
              ))}
            </VStack>
          )}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  )
}
