import { useEffect, useRef, useState } from 'react'
import { Box, Flex, Text, VStack, Center, IconButton } from '@chakra-ui/react'
import { DeleteIcon } from '@chakra-ui/icons'
import {
  WEEKDAYS,
  HOUR_HEIGHT,
  GUTTER,
  TOTAL_HEIGHT,
  EVENT_STYLE,
  isSameDay,
  layoutDay,
  minutesOfDay,
  minuteToTime,
  overlapsDay,
  formatTime,
  type EventRow,
  type SharingState,
} from './calendarUtils'

interface TimeGridViewProps {
  days: Date[]
  events: EventRow[]
  now: Date
  currentUserId: string | undefined
  onSlotClick: (day: Date, minute: number) => void
  onDelete: (id: string) => void
}

export function TimeGridView({
  days,
  events,
  now,
  currentUserId,
  onSlotClick,
  onDelete,
}: TimeGridViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [hoverSlot, setHoverSlot] = useState<{ dayIso: string; minute: number } | null>(null)

  // Scroll to ~7:00 on mount so the morning is in view.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT - 12
  }, [])

  function minuteFromPointer(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const snapped = Math.floor(((y / HOUR_HEIGHT) * 60) / 15) * 15
    return Math.max(0, Math.min(23 * 60 + 45, snapped))
  }

  const hasAllDay = events.some((e) => e.isAllDay)
  const minColWidth = days.length === 1 ? 'auto' : '100px'

  return (
    <Box bg="paper-2" border="1px solid" borderColor="gray.200" borderRadius="xl" overflow="hidden">
      <Box overflowX="auto">
        <Box minW={days.length === 1 ? 'auto' : '760px'}>
          {/* Single scroll container so the header and the time grid share the
              same width and the same scrollbar — keeps columns aligned. */}
          <Flex
            ref={scrollRef}
            direction="column"
            overflowY="auto"
            maxH={{ base: '60vh', md: 'calc(100vh - 320px)' }}
          >
            {/* Sticky header: day labels + all-day row stay visible while scrolling */}
            <Box position="sticky" top={0} zIndex={4} bg="paper-2">
              {/* Day headers */}
              <Flex borderBottom="1px solid" borderColor="gray.200">
            <Box w={`${GUTTER}px`} flexShrink={0} />
            {days.map((d) => {
              const today = isSameDay(d, now)
              const dow = d.getDay()
              return (
                <VStack
                  key={d.toISOString()}
                  flex={1}
                  minW={minColWidth}
                  spacing={1}
                  py={2.5}
                  borderLeft="1px solid"
                  borderColor="gray.100"
                >
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    color={dow === 0 ? 'danger.500' : dow === 6 ? 'primary.600' : 'gray.400'}
                  >
                    {WEEKDAYS[dow]}
                  </Text>
                  <Center boxSize={8} borderRadius="full" bg={today ? 'signal.500' : 'transparent'}>
                    <Text
                      fontFamily="heading"
                      fontWeight="700"
                      fontSize="lg"
                      lineHeight="1"
                      color={today ? 'white' : 'gray.900'}
                    >
                      {d.getDate()}
                    </Text>
                  </Center>
                </VStack>
              )
            })}
          </Flex>

          {/* All-day row */}
          {hasAllDay && (
            <Flex borderBottom="1px solid" borderColor="gray.200" bg="gray.50">
              <Center w={`${GUTTER}px`} flexShrink={0} px={1}>
                <Text fontSize="10px" fontWeight="bold" color="gray.400">
                  終日
                </Text>
              </Center>
              {days.map((d) => {
                const allDay = events.filter((e) => e.isAllDay && overlapsDay(e, d))
                return (
                  <VStack
                    key={d.toISOString()}
                    flex={1}
                    minW={minColWidth}
                    spacing={1}
                    align="stretch"
                    p={1}
                    minH="32px"
                    borderLeft="1px solid"
                    borderColor="gray.100"
                  >
                    {allDay.map((ev) => {
                      const style = EVENT_STYLE[ev.sharingState as SharingState] ?? EVENT_STYLE.private
                      const mine = currentUserId && ev.createdBy === currentUserId
                      return (
                        <Flex
                          key={ev.id}
                          role="group"
                          align="center"
                          justify="space-between"
                          gap={1}
                          bg={style.bg}
                          borderLeft="3px solid"
                          borderLeftColor={style.accent}
                          borderRadius="sm"
                          px={1.5}
                          py={0.5}
                        >
                          <Text fontSize="xs" fontWeight="600" color={style.text} noOfLines={1}>
                            {ev.name}
                          </Text>
                          {mine && (
                            <IconButton
                              aria-label="削除"
                              size="xs"
                              minW="auto"
                              h="auto"
                              p={0.5}
                              variant="ghost"
                              color={style.time}
                              icon={<DeleteIcon boxSize={2.5} />}
                              opacity={0}
                              _groupHover={{ opacity: 1 }}
                              _hover={{ color: 'danger.500', bg: 'transparent' }}
                              onClick={() => onDelete(ev.id)}
                            />
                          )}
                        </Flex>
                      )
                    })}
                  </VStack>
                )
              })}
            </Flex>
          )}
            </Box>

            {/* Time grid — scrolls under the sticky header above */}
            <Flex position="relative">
            <Box w={`${GUTTER}px`} flexShrink={0} position="relative" h={`${TOTAL_HEIGHT}px`}>
              {Array.from({ length: 23 }).map((_, i) => {
                const hour = i + 1
                return (
                  <Text
                    key={hour}
                    position="absolute"
                    top={`${hour * HOUR_HEIGHT}px`}
                    right="8px"
                    transform="translateY(-50%)"
                    fontSize="11px"
                    fontFamily="mono"
                    color="gray.400"
                  >
                    {hour}:00
                  </Text>
                )
              })}
            </Box>

            <Flex
              flex={1}
              position="relative"
              h={`${TOTAL_HEIGHT}px`}
              backgroundImage={`repeating-linear-gradient(to bottom, var(--line) 0, var(--line) 1px, transparent 1px, transparent ${HOUR_HEIGHT}px)`}
            >
              {days.map((d) => {
                const today = isSameDay(d, now)
                const positioned = layoutDay(d, events)
                const dayIso = d.toISOString()
                const ghostMinute = hoverSlot?.dayIso === dayIso ? hoverSlot.minute : null
                const nowMinutes = minutesOfDay(now)
                return (
                  <Box
                    key={dayIso}
                    flex={1}
                    minW={minColWidth}
                    position="relative"
                    borderLeft="1px solid"
                    borderColor="gray.100"
                    cursor="pointer"
                    onMouseMove={(e) => {
                      const minute = minuteFromPointer(e)
                      if (hoverSlot?.dayIso !== dayIso || hoverSlot.minute !== minute) {
                        setHoverSlot({ dayIso, minute })
                      }
                    }}
                    onMouseLeave={() => setHoverSlot((s) => (s?.dayIso === dayIso ? null : s))}
                    onClick={(e) => onSlotClick(d, minuteFromPointer(e))}
                  >
                    {ghostMinute !== null && (
                      <Box
                        position="absolute"
                        top={`${(ghostMinute / 60) * HOUR_HEIGHT}px`}
                        left="2px"
                        right="2px"
                        height={`${Math.min(HOUR_HEIGHT, ((24 * 60 - ghostMinute) / 60) * HOUR_HEIGHT) - 2}px`}
                        bg="primary.50"
                        border="1px dashed"
                        borderColor="primary.400"
                        borderRadius="sm"
                        px={1.5}
                        py={0.5}
                        pointerEvents="none"
                        zIndex={1}
                      >
                        <Text fontSize="10px" fontWeight="600" color="primary.700">
                          + {minuteToTime(ghostMinute)}
                        </Text>
                      </Box>
                    )}

                    {positioned.map(({ ev, start, end, fromPrev, toNext, colIndex, colCount }) => {
                      const style = EVENT_STYLE[ev.sharingState as SharingState] ?? EVENT_STYLE.private
                      const mine = currentUserId && ev.createdBy === currentUserId
                      return (
                        <Box
                          key={ev.id}
                          role="group"
                          position="absolute"
                          top={`${(start / 60) * HOUR_HEIGHT}px`}
                          height={`${((end - start) / 60) * HOUR_HEIGHT - 2}px`}
                          left={`calc(${(colIndex / colCount) * 100}% + 2px)`}
                          width={`calc(${100 / colCount}% - 4px)`}
                          bg={style.bg}
                          borderLeft="3px solid"
                          borderLeftColor={style.accent}
                          borderTopRadius={fromPrev ? 'none' : 'sm'}
                          borderBottomRadius={toNext ? 'none' : 'sm'}
                          px={1.5}
                          py={1}
                          overflow="hidden"
                          cursor="default"
                          transition="filter 0.1s"
                          _hover={{ filter: 'brightness(0.97)', zIndex: 2 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Flex justify="space-between" align="start" gap={1}>
                            <Text
                              fontSize="xs"
                              fontWeight="600"
                              color={style.text}
                              noOfLines={end - start <= 30 ? 1 : 2}
                              lineHeight="1.2"
                            >
                              {fromPrev && '↑ '}
                              {ev.name}
                              {toNext && ' ↓'}
                            </Text>
                            {mine && (
                              <IconButton
                                aria-label="削除"
                                size="xs"
                                minW="auto"
                                h="auto"
                                p={0.5}
                                variant="ghost"
                                color={style.time}
                                icon={<DeleteIcon boxSize={2.5} />}
                                opacity={0}
                                _groupHover={{ opacity: 1 }}
                                _hover={{ color: 'danger.500', bg: 'transparent' }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDelete(ev.id)
                                }}
                              />
                            )}
                          </Flex>
                          {end - start > 30 && (
                            <Text fontSize="10px" fontFamily="mono" color={style.time}>
                              {formatTime(ev.startAt)}–{formatTime(ev.endAt)}
                            </Text>
                          )}
                        </Box>
                      )
                    })}

                    {today && (
                      <Box
                        position="absolute"
                        left={0}
                        right={0}
                        top={`${(nowMinutes / 60) * HOUR_HEIGHT}px`}
                        h="2px"
                        bg="signal.500"
                        zIndex={3}
                        pointerEvents="none"
                      >
                        <Box
                          position="absolute"
                          left="-4px"
                          top="-3px"
                          boxSize="8px"
                          borderRadius="full"
                          bg="signal.500"
                        />
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Flex>
            </Flex>
          </Flex>
        </Box>
      </Box>
    </Box>
  )
}
