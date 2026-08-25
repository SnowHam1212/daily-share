import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
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
  Center,
  Spinner,
  useDisclosure,
} from '@chakra-ui/react'
import { avatarColor } from '../../lib/avatarColor'
import { useAuth } from '../../hooks/useAuth'
import { useUnreadMessages } from '../../hooks/useUnreadMessages'
import { formatBadgeCount } from '../Chat/unreadUtils'
import { useRedeemPendingInvite } from '../../hooks/usePendingInvite'
import { Wordmark } from '../ui/Wordmark'
import { AccountModal } from '../Account/AccountModal'
import { NotificationBell } from '../Notifications/NotificationBell'

// Each tab is code-split: its JS (incl. Leaflet for the map) only loads when the
// tab is first opened, keeping the initial bundle small. `isLazy` on <Tabs>
// ensures panels mount on demand, which triggers these dynamic imports.
const CalendarTab = lazy(() => import('../Calendar/CalendarTab'))
const MapTab = lazy(() => import('../Map/MapTab'))
const ChatTab = lazy(() => import('../Chat/ChatTab'))
const FriendsTab = lazy(() => import('../Friends/FriendsTab'))
const TeamsTab = lazy(() => import('../Team/TeamsTab'))

/** タブの並び順（カレンダー・地図・トーク・フレンド・チーム）における「トーク」。 */
const TALK_TAB_INDEX = 2

/** ヘッダーのタブ定義。badge を持つタブにだけ未読バッジを出す。 */
const TABS: { icon: string; label: string; badge?: boolean }[] = [
  { icon: '🗓', label: 'カレンダー' },
  { icon: '🗺', label: 'マップ' },
  { icon: '💬', label: 'チャット', badge: true },
  { icon: '🤝', label: 'フレンド' },
  { icon: '👥', label: 'チーム' },
]

function TabFallback() {
  return (
    <Center py={20}>
      <Spinner color="primary.500" thickness="3px" />
    </Center>
  )
}

export function MainLayout() {
  const { user, profile, teams, signOut, refreshProfile } = useAuth()
  // 未読件数は MainLayout 側で数える。<Tabs isLazy> はタブを離れると
  // ChatTab を unmount するため、ChatTab の中では数え続けられない。
  const teamIds = useMemo(() => teams.map((t) => t.id), [teams])
  const { unreadByTeam, unreadTotal, markTeamRead } = useUnreadMessages(user?.id, teamIds)
  const [tabIndex, setTabIndex] = useState(0)
  const name = profile?.displayName ?? 'ゲスト'
  const email = profile?.email ?? user?.email ?? ''

  // 招待リンク（/join/:code）で来た場合、ここで参加する。
  // 参加後はトークタブへ移し、入ったルームがすぐ見えるようにする。
  const handleJoinedByInvite = useCallback(async () => {
    await refreshProfile()
    setTabIndex(TALK_TAB_INDEX)
  }, [refreshProfile])
  useRedeemPendingInvite(user?.id, handleJoinedByInvite)

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
                {TABS.map((t) => (
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
                      {/* 未読バッジはアイコンの右肩に重ねるので relative が要る */}
                      <Box as="span" position="relative">
                        {t.icon}
                        {t.badge && unreadTotal > 0 && (
                          <Box
                            as="span"
                            position="absolute"
                            top="-6px"
                            right="-8px"
                            minW="16px"
                            px="4px"
                            bg="danger.500"
                            color="white"
                            borderRadius="full"
                            fontSize="10px"
                            lineHeight="16px"
                            fontWeight="bold"
                            textAlign="center"
                            aria-label={`未読 ${unreadTotal} 件`}
                          >
                            {formatBadgeCount(unreadTotal)}
                          </Box>
                        )}
                      </Box>
                      <Box as="span" display={{ base: 'none', sm: 'block' }}>
                        {t.label}
                      </Box>
                    </HStack>
                  </Tab>
                ))}
              </TabList>

              <HStack spacing={1}>
              <NotificationBell userId={user?.id} />
              <Menu>
                <MenuButton
                  as={Button}
                  variant="ghost"
                  px={2}
                  borderRadius="full"
                >
                  <Avatar size="sm" name={name} bg={avatarColor(user?.id)} color="white" />
                </MenuButton>
                <MenuList borderRadius="xl" borderColor="gray.200" boxShadow="lg" minW="240px">
                  <HStack px={3} py={2} spacing={3}>
                    <Avatar size="sm" name={name} bg={avatarColor(user?.id)} color="white" />
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
              </HStack>
            </Flex>
          </Container>
        </Box>

        <Container as="main" maxW="6xl" px={{ base: 4, md: 6 }} py={{ base: 5, md: 8 }}>
          <TabPanels>
            <TabPanel p={0}>
              <Suspense fallback={<TabFallback />}>
                <CalendarTab />
              </Suspense>
            </TabPanel>
            <TabPanel p={0}>
              <Suspense fallback={<TabFallback />}>
                <MapTab />
              </Suspense>
            </TabPanel>
            <TabPanel p={0}>
              <Suspense fallback={<TabFallback />}>
                <ChatTab unreadByTeam={unreadByTeam} onOpenRoom={markTeamRead} />
              </Suspense>
            </TabPanel>
            <TabPanel p={0}>
              <Suspense fallback={<TabFallback />}>
                <FriendsTab />
              </Suspense>
            </TabPanel>
            <TabPanel p={0}>
              <Suspense fallback={<TabFallback />}>
                <TeamsTab />
              </Suspense>
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
