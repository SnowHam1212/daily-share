import { lazy, Suspense, useCallback, useState } from 'react'
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
import { MOBILE_NAV_HEIGHT, aboveMobileNav } from '../../theme/layout'
import { useAuth } from '../../hooks/useAuth'
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

const TABS = [
  { icon: '🗓', label: 'カレンダー' },
  { icon: '🗺', label: 'マップ' },
  { icon: '💬', label: 'チャット' },
  { icon: '🤝', label: 'フレンド' },
  { icon: '👥', label: 'チーム' },
] as const

function TabFallback() {
  return (
    <Center py={20}>
      <Spinner color="primary.500" thickness="3px" />
    </Center>
  )
}

export function MainLayout() {
  const { user, profile, signOut, refreshProfile } = useAuth()
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
    <Box minH="100svh" bg="paper">
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
          // Leaflet のコントロール（z-index 1000）より前に出す。
          // Chakra のモーダル（1400）より後ろに保つこと。
          zIndex={1100}
        >
          <Container maxW="6xl" px={{ base: 4, md: 6 }}>
            <Flex align="center" justify="space-between" h={16} gap={{ base: 2, md: 4 }}>
              <Wordmark size="sm" flexShrink={0} />

              {/* タブ本体。スマホでは横幅に収まらないため隠し、画面下の
                  ナビ（下部の <Flex as="nav">）から同じタブを切り替える。 */}
              <TabList
                gap={1}
                bg="gray.100"
                p={1}
                borderRadius="full"
                display={{ base: 'none', md: 'flex' }}
              >
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
                      <Box as="span">{t.icon}</Box>
                      <Box as="span" display={{ base: 'none', lg: 'block' }}>
                        {t.label}
                      </Box>
                    </HStack>
                  </Tab>
                ))}
              </TabList>

              <HStack spacing={1} flexShrink={0}>
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

        <Container
          as="main"
          maxW="6xl"
          px={{ base: 3, md: 6 }}
          pt={{ base: 4, md: 8 }}
          // スマホは下部ナビの下に本文が潜り込まないよう、その分の余白を空ける。
          pb={{ base: aboveMobileNav(), md: 8 }}
        >
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
                <ChatTab />
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

        {/* スマホ用の下部ナビ。ヘッダーに 5 タブ＋ロゴ＋通知＋アカウントを
            並べると 390px 幅に収まらず、ブラウザがページ全体を縮小して
            レイアウトが崩れるため、狭い画面ではタブをここへ逃がす。 */}
        <Flex
          as="nav"
          aria-label="メインナビゲーション"
          display={{ base: 'flex', md: 'none' }}
          position="fixed"
          bottom={0}
          left={0}
          right={0}
          // 地図タブでは Leaflet のコントロール（z-index 1000）が
          // 重なってくるので、それより前に置く。
          zIndex={1100}
          bg="paper-2"
          borderTop="1px solid"
          borderColor="gray.200"
          pb="env(safe-area-inset-bottom)"
        >
          {TABS.map((t, i) => {
            const selected = tabIndex === i
            return (
              <Box
                as="button"
                type="button"
                key={t.label}
                flex={1}
                minW={0}
                h={MOBILE_NAV_HEIGHT}
                onClick={() => setTabIndex(i)}
                aria-current={selected ? 'page' : undefined}
                color={selected ? 'primary.600' : 'gray.500'}
                transition="color 0.15s"
              >
                <Box as="span" display="block" fontSize="lg" lineHeight="1.4">
                  {t.icon}
                </Box>
                <Box
                  as="span"
                  display="block"
                  fontSize="10px"
                  fontWeight="semibold"
                  letterSpacing="-0.02em"
                >
                  {t.label}
                </Box>
              </Box>
            )
          })}
        </Flex>
      </Tabs>

      {account.isOpen && (
        <AccountModal isOpen onClose={account.onClose} initialTab={accountTab} />
      )}
    </Box>
  )
}
