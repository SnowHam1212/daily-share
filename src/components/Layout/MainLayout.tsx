import { useState } from 'react'
import CalendarTab from '../Calendar/CalendarTab'
import MapTab from '../Map/MapTab'
import TeamsTab from '../Team/TeamsTab'
import ChatTab from '../Chat/ChatTab'
import FriendsTab from '../Friends/FriendsTab'
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
  Container,
  useDisclosure,
} from '@chakra-ui/react'
import { useAuth } from '../../hooks/useAuth'
import { Wordmark } from '../ui/Wordmark'
import { AccountModal } from '../Account/AccountModal'

// CalendarTab is implemented in src/components/Calendar/CalendarTab.tsx
// MapTab (live Leaflet map) is implemented in src/components/Map/MapTab.tsx

export function MainLayout() {
  const { user, profile, signOut } = useAuth()
  const [tabIndex, setTabIndex] = useState(0)
  const name = profile?.displayName ?? 'ゲスト'
  const email = profile?.email ?? user?.email ?? ''

  const account = useDisclosure()
  const [accountTab, setAccountTab] = useState(0)
  const openAccount = (tab: number) => {
    setAccountTab(tab)
    account.onOpen()
  }

  return (
    <Box minH="100vh" bg="paper">
      <Tabs
        index={tabIndex}
        onChange={(index) => setTabIndex(index)}
        variant="unstyled"
        isLazy
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
                  { icon: '💬', label: 'チャット' },
                  { icon: '🤝', label: 'フレンド' },
                  { icon: '👥', label: 'チーム' },
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
                <MenuList borderRadius="xl" borderColor="gray.200" boxShadow="lg" minW="240px">
                  <HStack px={3} py={2} spacing={3}>
                    <Avatar size="sm" name={name} bg="primary.500" color="white" />
                    <Box minW={0}>
                      <Text fontWeight="semibold" color="gray.900" noOfLines={1}>
                        {name}
                      </Text>
                      {email && (
                        <Text fontSize="xs" color="gray.500" noOfLines={1}>
                          {email}
                        </Text>
                      )}
                    </Box>
                  </HStack>
                  <MenuDivider borderColor="gray.200" />
                  <MenuItem icon={<Box as="span">👤</Box>} onClick={() => openAccount(0)}>
                    プロフィール
                  </MenuItem>
                  <MenuItem icon={<Box as="span">⚙️</Box>} onClick={() => openAccount(1)}>
                    設定
                  </MenuItem>
                  <MenuDivider borderColor="gray.200" />
                  <MenuItem
                    icon={<Box as="span">🚪</Box>}
                    onClick={() => signOut()}
                    color="danger.600"
                  >
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
              <CalendarTab />
            </TabPanel>
            <TabPanel p={0}>
              <MapTab />
            </TabPanel>
            <TabPanel p={0}>
              <ChatTab />
            </TabPanel>
            <TabPanel p={0}>
              <FriendsTab />
            </TabPanel>
            <TabPanel p={0}>
              <TeamsTab />
            </TabPanel>
          </TabPanels>
        </Container>
      </Tabs>

      {account.isOpen && (
        <AccountModal isOpen onClose={account.onClose} initialTab={accountTab} />
      )}
    </Box>
  )
}
