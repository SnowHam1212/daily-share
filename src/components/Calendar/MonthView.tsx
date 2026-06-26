import { Box, Grid, Flex, Text, VStack, Center } from '@chakra-ui/react'
import {
  WEEKDAYS,
  EVENT_STYLE,
  isSameDay,
  isSameMonth,
  monthGridDays,
  overlapsDay,
  formatTime,
  type EventRow,
  type SharingState,
} from './calendarUtils'

interface MonthViewProps {
  anchor: Date
  events: EventRow[]
  now: Date
  onDayClick: (day: Date) => void
  onEventClick: (ev: EventRow) => void
}

const MAX_CHIPS = 3

export function MonthView({ anchor, events, now, onDayClick, onEventClick }: MonthViewProps) {
  const days = monthGridDays(anchor)

  return (
    <Box bg="paper-2" border="1px solid" borderColor="gray.200" borderRadius="xl" overflow="hidden">
      {/* Weekday header */}
      <Grid templateColumns="repeat(7, 1fr)" borderBottom="1px solid" borderColor="gray.200">
        {WEEKDAYS.map((w, i) => (
          <Center key={w} py={2}>
            <Text
              fontSize="xs"
              fontWeight="bold"
              color={i === 0 ? 'danger.500' : i === 6 ? 'primary.600' : 'gray.400'}
            >
              {w}
            </Text>
          </Center>
        ))}
      </Grid>

      {/* 6-week grid */}
      <Grid templateColumns="repeat(7, 1fr)" templateRows="repeat(6, 1fr)" h={{ base: 'auto', md: 'calc(100dvh - 200px)' }}>
        {days.map((d) => {
          const inMonth = isSameMonth(d, anchor)
          const today = isSameDay(d, now)
          const dow = d.getDay()
          const dayEvents = events
            .filter((e) => overlapsDay(e, d))
            .sort((a, b) => {
              // all-day first, then by start time
              if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1
              return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
            })
          const shown = dayEvents.slice(0, MAX_CHIPS)
          const extra = dayEvents.length - shown.length

          return (
            <Box
              key={d.toISOString()}
              borderRight="1px solid"
              borderBottom="1px solid"
              borderColor="gray.100"
              bg={inMonth ? 'transparent' : 'gray.50'}
              p={1.5}
              minH={{ base: '90px', md: 0 }}
              overflow="hidden"
              cursor="pointer"
              transition="background 0.1s"
              _hover={{ bg: inMonth ? 'gray.50' : 'gray.100' }}
              onClick={() => onDayClick(d)}
            >
              <Flex justify="center" mb={1}>
                <Center
                  boxSize={6}
                  borderRadius="full"
                  bg={today ? 'signal.500' : 'transparent'}
                >
                  <Text
                    fontSize="sm"
                    fontWeight={today ? '700' : '600'}
                    color={
                      today
                        ? 'white'
                        : !inMonth
                          ? 'gray.400'
                          : dow === 0
                            ? 'danger.500'
                            : dow === 6
                              ? 'primary.600'
                              : 'gray.700'
                    }
                  >
                    {d.getDate()}
                  </Text>
                </Center>
              </Flex>

              <VStack spacing="2px" align="stretch">
                {shown.map((ev) => {
                  const style = EVENT_STYLE[ev.sharingState as SharingState] ?? EVENT_STYLE.private
                  return (
                    <Flex
                      key={ev.id}
                      align="center"
                      gap={1}
                      bg={ev.isAllDay ? style.bg : 'transparent'}
                      borderRadius="sm"
                      px={1}
                      h="18px"
                      overflow="hidden"
                      cursor="pointer"
                      _hover={{ bg: ev.isAllDay ? style.bg : 'gray.100' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick(ev)
                      }}
                    >
                      {!ev.isAllDay && (
                        <Box boxSize="6px" borderRadius="full" bg={style.dot} flexShrink={0} />
                      )}
                      {!ev.isAllDay && (
                        <Text fontSize="10px" fontFamily="mono" color="gray.500" flexShrink={0}>
                          {formatTime(ev.startAt)}
                        </Text>
                      )}
                      <Text fontSize="11px" fontWeight="500" color={style.text} noOfLines={1}>
                        {ev.name}
                      </Text>
                    </Flex>
                  )
                })}
                {extra > 0 && (
                  <Text fontSize="10px" color="gray.500" pl={1}>
                    他 {extra} 件
                  </Text>
                )}
              </VStack>
            </Box>
          )
        })}
      </Grid>
    </Box>
  )
}
