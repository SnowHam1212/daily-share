import { useMemo, useState } from 'react'
import {
  Box,
  Flex,
  Grid,
  Text,
  VStack,
  HStack,
  IconButton,
  Checkbox,
  Center,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverBody,
  PopoverArrow,
  Select,
  SimpleGrid,
  useDisclosure,
} from '@chakra-ui/react'
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon, AddIcon } from '@chakra-ui/icons'
import { Button } from '../ui/Button'
import {
  WEEKDAYS,
  SHARING,
  addMonths,
  monthGridDays,
  isSameDay,
  isSameMonth,
  type SharingState,
} from './calendarUtils'

type SidebarTeam = { id: string; teamName: string }

interface CalendarSidebarProps {
  anchor: Date
  now: Date
  onPickDate: (day: Date) => void
  onCreate: () => void
  filters: Set<SharingState>
  onToggleFilter: (s: SharingState) => void
  teams: SidebarTeam[]
  hiddenTeams: Set<string>
  onToggleTeam: (teamId: string) => void
}

export function CalendarSidebar({
  anchor,
  now,
  onPickDate,
  onCreate,
  filters,
  onToggleFilter,
  teams,
  hiddenTeams,
  onToggleTeam,
}: CalendarSidebarProps) {
  // The month shown in the mini calendar (independent of the main anchor).
  const [miniMonth, setMiniMonth] = useState(() => new Date(anchor))
  const days = monthGridDays(miniMonth)

  // Jump the whole calendar to today and bring the mini calendar back to it.
  function goToday() {
    onPickDate(now)
    setMiniMonth(new Date(now))
  }

  const { isOpen, onOpen, onClose } = useDisclosure()
  const yearOptions = useMemo(() => {
    const base = miniMonth.getFullYear()
    return Array.from({ length: 21 }, (_, i) => base - 10 + i)
  }, [miniMonth])

  return (
    <Box
      w="260px"
      flexShrink={0}
      display={{ base: 'none', lg: 'block' }}
      pr={6}
      maxH={{ lg: 'calc(100dvh - 136px)' }}
      overflowY={{ lg: 'auto' }}
    >
      <Button
        variant="signal"
        leftIcon={<AddIcon boxSize={3} />}
        onClick={onCreate}
        mb={4}
        boxShadow="md"
      >
        作成
      </Button>

      {/* Always-visible "today" card — jumps to today on click */}
      <Flex
        as="button"
        type="button"
        onClick={goToday}
        align="center"
        gap={2.5}
        w="full"
        mb={4}
        p={2}
        borderRadius="xl"
        border="1px solid"
        borderColor="gray.200"
        bg="paper-2"
        textAlign="left"
        transition="all 0.15s"
        _hover={{ borderColor: 'signal.300', bg: 'signal.50' }}
      >
        <Center
          boxSize={10}
          flexShrink={0}
          flexDirection="column"
          lineHeight="1"
          borderRadius="lg"
          bg="signal.500"
          color="white"
        >
          <Text fontSize="9px" fontWeight="bold">
            {now.getMonth() + 1}月
          </Text>
          <Text fontFamily="heading" fontWeight="700" fontSize="lg">
            {now.getDate()}
          </Text>
        </Center>
        <Box>
          <Text fontSize="xs" color="gray.500">
            今日
          </Text>
          <Text fontSize="sm" fontWeight="600" color="gray.900">
            {now.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
          </Text>
        </Box>
      </Flex>

      {/* Mini month calendar */}
      <Box mb={4}>
        <Flex align="center" justify="space-between" mb={2}>
          <Popover isOpen={isOpen} onOpen={onOpen} onClose={onClose} placement="bottom-start">
            <PopoverTrigger>
              <Text
                fontFamily="heading"
                fontWeight="700"
                fontSize="sm"
                color="gray.900"
                cursor="pointer"
                px={1.5}
                py={1}
                borderRadius="md"
                _hover={{ bg: 'gray.100' }}
                title="クリックで年月を移動"
              >
                {miniMonth.getFullYear()}年 {miniMonth.getMonth() + 1}月
              </Text>
            </PopoverTrigger>
            <PopoverContent w="260px">
              <PopoverArrow />
              <PopoverBody>
                <Text fontSize="xs" fontWeight="600" mb={1} color="gray.500">
                  年
                </Text>
                <Select
                  size="sm"
                  mb={3}
                  value={miniMonth.getFullYear()}
                  onChange={(e) =>
                    setMiniMonth((m) => new Date(Number(e.target.value), m.getMonth(), 1))
                  }
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}年
                    </option>
                  ))}
                </Select>
                <Text fontSize="xs" fontWeight="600" mb={1} color="gray.500">
                  月
                </Text>
                <SimpleGrid columns={4} spacing={2}>
                  {Array.from({ length: 12 }, (_, m) => (
                    <Button
                      key={m}
                      size="sm"
                      variant={miniMonth.getMonth() === m ? 'signal' : 'secondary'}
                      onClick={() => {
                        setMiniMonth((cur) => new Date(cur.getFullYear(), m, 1))
                        onClose()
                      }}
                    >
                      {m + 1}月
                    </Button>
                  ))}
                </SimpleGrid>
              </PopoverBody>
            </PopoverContent>
          </Popover>
          <HStack spacing={0}>
            <IconButton
              aria-label="前の月"
              icon={<ChevronLeftIcon />}
              size="xs"
              variant="ghost"
              onClick={() => setMiniMonth((m) => addMonths(m, -1))}
            />
            <IconButton
              aria-label="次の月"
              icon={<ChevronRightIcon />}
              size="xs"
              variant="ghost"
              onClick={() => setMiniMonth((m) => addMonths(m, 1))}
            />
          </HStack>
        </Flex>

        <Grid templateColumns="repeat(7, 1fr)" gap="2px">
          {WEEKDAYS.map((w, i) => (
            <Center key={w} h={6}>
              <Text fontSize="10px" color={i === 0 ? 'danger.400' : i === 6 ? 'primary.400' : 'gray.400'}>
                {w}
              </Text>
            </Center>
          ))}
          {days.map((d) => {
            const today = isSameDay(d, now)
            const selected = isSameDay(d, anchor)
            const inMonth = isSameMonth(d, miniMonth)
            return (
              <Center key={d.toISOString()} h={7}>
                <Center
                  as="button"
                  boxSize={7}
                  borderRadius="full"
                  fontSize="xs"
                  fontWeight={today || selected ? '700' : '500'}
                  color={
                    selected ? 'white' : today ? 'signal.600' : inMonth ? 'gray.700' : 'gray.300'
                  }
                  bg={selected ? 'primary.500' : 'transparent'}
                  border={today && !selected ? '1.5px solid' : '1.5px solid transparent'}
                  borderColor={today && !selected ? 'signal.400' : 'transparent'}
                  _hover={{ bg: selected ? 'primary.600' : 'gray.100' }}
                  onClick={() => onPickDate(d)}
                >
                  {d.getDate()}
                </Center>
              </Center>
            )
          })}
        </Grid>
      </Box>

      {/* My calendars (filter by sharing scope) */}
      <Box>
        <Text fontSize="xs" fontWeight="bold" color="gray.500" mb={2} letterSpacing="wide">
          マイカレンダー
        </Text>
        <VStack align="stretch" spacing={2}>
          {(Object.keys(SHARING) as SharingState[]).map((key) => (
            <Checkbox
              key={key}
              isChecked={filters.has(key)}
              onChange={() => onToggleFilter(key)}
              colorScheme={SHARING[key].colorScheme}
              size="sm"
            >
              <Text fontSize="sm" color="gray.700">
                {SHARING[key].label}
              </Text>
            </Checkbox>
          ))}
        </VStack>
      </Box>

      {/* Team filter — a pull-down checklist of the user's teams */}
      {teams.length > 0 && (
        <Box mt={4}>
          <Text fontSize="xs" fontWeight="bold" color="gray.500" mb={2} letterSpacing="wide">
            チーム
          </Text>
          <Popover placement="bottom-start">
            <PopoverTrigger>
              <Button
                variant="secondary"
                w="full"
                justifyContent="space-between"
                rightIcon={<ChevronDownIcon />}
                fontWeight="500"
              >
                <Text fontSize="sm" noOfLines={1}>
                  {teams.length - hiddenTeams.size === teams.length
                    ? 'すべてのチーム'
                    : `${teams.length - hiddenTeams.size}/${teams.length} チーム`}
                </Text>
              </Button>
            </PopoverTrigger>
            <PopoverContent w="240px">
              <PopoverArrow />
              <PopoverBody>
                <VStack align="stretch" spacing={2} maxH="240px" overflowY="auto">
                  {teams.map((t) => (
                    <Checkbox
                      key={t.id}
                      isChecked={!hiddenTeams.has(t.id)}
                      onChange={() => onToggleTeam(t.id)}
                      colorScheme="primary"
                      size="sm"
                    >
                      <Text fontSize="sm" color="gray.700" noOfLines={1}>
                        {t.teamName}
                      </Text>
                    </Checkbox>
                  ))}
                </VStack>
              </PopoverBody>
            </PopoverContent>
          </Popover>
        </Box>
      )}
    </Box>
  )
}
