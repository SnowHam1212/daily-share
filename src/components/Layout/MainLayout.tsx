import { useState } from 'react'
import CalendarTab from '../Calendar/CalendarTab'
import MapTab from '../Map/MapTab'
import {
  Box,
  Flex,
  Heading,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
} from '@chakra-ui/react'
import { useAuth } from '../../hooks/useAuth'

export function MainLayout() {
  const { profile, signOut } = useAuth()
  const [tabIndex, setTabIndex] = useState(0)

  return (
    <Box minH="100vh" bg="gray.50">
      <Tabs
        index={tabIndex}
        onChange={(index) => setTabIndex(index)}
        variant="soft-rounded"
        colorScheme="blue"
      >
        <Box
          as="header"
          bg="white"
          px={6}
          py={4}
          boxShadow="sm"
          position="sticky"
          top={0}
          zIndex={10}
        >
          <Flex align="center" gap={4}>
            <Heading size="md">Daily Share</Heading>

            <TabList flex="1">
              <Tab>📅 カレンダー</Tab>
              <Tab>🗺️ マップ</Tab>
            </TabList>

            <Menu>
              <MenuButton as={Button} variant="ghost">
                {profile?.displayName ?? 'プロフィール'}
              </MenuButton>
              <MenuList>
                <MenuItem onClick={() => signOut()}>ログアウト</MenuItem>
              </MenuList>
            </Menu>
          </Flex>
        </Box>

        <Box as="main" p={6}>
          <TabPanels>
            <TabPanel p={0}>
              <CalendarTab />
            </TabPanel>
            <TabPanel p={0}>
              <MapTab />
            </TabPanel>
          </TabPanels>
        </Box>
      </Tabs>
    </Box>
  )
}
