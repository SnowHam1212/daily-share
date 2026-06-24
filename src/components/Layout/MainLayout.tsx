import { useState } from 'react'
import CalendarTab from '../Calendar/CalendarTab'
import {
  Box,
  Flex,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  Button,
  Text,
  Avatar,
  HStack,
  VStack,
  Container,
} from '@chakra-ui/react'
import { useAuth } from '../../hooks/useAuth'
import { Wordmark } from '../ui/Wordmark'

// CalendarTab is implemented in src/components/Calendar/CalendarTab.tsx

function MapTab() {
  return (
    <Flex
      className="map-grid"
      bg="paper-2"
      direction="column"
      align="center"
      justify="center"
      textAlign="center"
      borderRadius="2xl"
      border="1px solid"
      borderColor="gray.200"
      px={8}
      py={20}
      minH="calc(100vh - 220px)"
      gap={4}
    >
      <Wordmark markOnly size="lg" />
      <Box>
        <Text fontFamily="heading" fontSize="2xl" fontWeight="700" color="gray.900">
          みんなの居場所がここに集まります
        </Text>
        <Text color="gray.500" mt={2} maxW="sm">
          位置情報を共有すると、仲間が今どこにいるかを地図上でリアルタイムに見られます。
        </Text>
      </Box>
    </Flex>
  )
}

export function MainLayout() {
  const { profile, signOut } = useAuth()
  const [tabIndex, setTabIndex] = useState(0)
  const name = profile?.displayName ?? 'ゲスト'

  return (
    <Box minH="100vh" bg="paper">
      <Tabs
        index={tabIndex}
        onChange={(index) => setTabIndex(index)}
        variant="unstyled"
      >
        <Box
          as="header"
          bg="paper-2"
          borderBottom="1px solid"
          borderColor="gray.200"
          position="sticky"
          top={0}
          zIndex={10}
        >
          <Container maxW="6xl" px={{ base: 4, md: 6 }}>
            <Flex align="center" justify="space-between" h={16} gap={4}>
              <Wordmark size="sm" />

              <TabList gap={1} bg="gray.100" p={1} borderRadius="full">
                {[
                  { icon: '🗓', label: 'カレンダー' },
                  { icon: '🗺', label: 'マップ' },
                ].map((t) => (
                  <Tab
                    key={t.label}
                    borderRadius="full"
                    px={{ base: 3, md: 5 }}
                    py={2}
                    fontSize="sm"
                    fontWeight="semibold"
                    color="gray.500"
                    transition="all 0.15s"
                    _selected={{ bg: 'paper-2', color: 'primary.700', boxShadow: 'sm' }}
                    _hover={{ color: 'gray.700' }}
                  >
                    <HStack spacing={1.5}>
                      <Box as="span">{t.icon}</Box>
                      <Box as="span" display={{ base: 'none', sm: 'block' }}>
                        {t.label}
                      </Box>
                    </HStack>
                  </Tab>
                ))}
              </TabList>

              <Menu>
                <MenuButton
                  as={Button}
                  variant="ghost"
                  px={2}
                  borderRadius="full"
                >
                  <Avatar size="sm" name={name} bg="primary.500" color="white" />
                </MenuButton>
                <MenuList borderRadius="xl" borderColor="gray.200" boxShadow="lg">
                  <Box px={3} py={2}>
                    <Text fontSize="xs" color="gray.500">
                      ログイン中
                    </Text>
                    <Text fontWeight="semibold" color="gray.900">
                      {name}
                    </Text>
                  </Box>
                  <MenuDivider borderColor="gray.200" />
                  <MenuItem onClick={() => signOut()} color="danger.600">
                    ログアウト
                  </MenuItem>
                </MenuList>
              </Menu>
            </Flex>
          </Container>
        </Box>

        <Container as="main" maxW="6xl" px={{ base: 4, md: 6 }} py={{ base: 5, md: 8 }}>
          <TabPanels>
            <TabPanel p={0}>
              <VStack align="stretch" spacing={6}>
                <CalendarTab />
              </VStack>
            </TabPanel>
            <TabPanel p={0}>
              <MapTab />
            </TabPanel>
          </TabPanels>
        </Container>
      </Tabs>
    </Box>
  )
}
