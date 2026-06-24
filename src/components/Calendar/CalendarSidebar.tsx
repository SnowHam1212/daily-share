import { useState } from 'react'
import { Box, Flex, Grid, Text, VStack, HStack, IconButton, Checkbox, Center } from '@chakra-ui/react'
import { ChevronLeftIcon, ChevronRightIcon, AddIcon } from '@chakra-ui/icons'
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

interface CalendarSidebarProps {
  anchor: Date
  now: Date
  onPickDate: (day: Date) => void
  onCreate: () => void
  filters: Set<SharingState>
  onToggleFilter: (s: SharingState) => void
}

export function CalendarSidebar({
  anchor,
  now,
  onPickDate,
  onCreate,
  filters,
  onToggleFilter,
}: CalendarSidebarProps) {
  // The month shown in the mini calendar (independent of the main anchor).
  const [miniMonth, setMiniMonth] = useState(() => new Date(anchor))
  const days = monthGridDays(miniMonth)

  return (
    <Box w="260px" flexShrink={0} display={{ base: 'none', lg: 'block' }} pr={6}>
      <Button
        variant="signal"
        leftIcon={<AddIcon boxSize={3} />}
        onClick={onCreate}
        mb={6}
        boxShadow="md"
      >
        作成
      </Button>

      {/* Mini month calendar */}
      <Box mb={6}>
        <Flex align="center" justify="space-between" mb={2}>
          <Text fontFamily="heading" fontWeight="700" fontSize="sm" color="gray.900">
            {miniMonth.getFullYear()}年 {miniMonth.getMonth() + 1}月
          </Text>
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
    </Box>
  )
}
