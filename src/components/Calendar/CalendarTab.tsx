import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  Heading,
  Text,
  HStack,
  VStack,
  IconButton,
  useDisclosure,
  Spinner,
  Flex,
  Badge,
  Center,
  Switch,
  Input as ChakraInput,
} from '@chakra-ui/react'
import { ChevronLeftIcon, ChevronRightIcon, AddIcon, DeleteIcon } from '@chakra-ui/icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { EventModal } from './EventModal'
import type { Database } from '../../types/database'

type EventRow = Database['public']['Tables']['events']['Row']

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

const HOUR_HEIGHT = 48 // px per hour
const GUTTER = 56 // px — time labels column
const TOTAL_HEIGHT = HOUR_HEIGHT * 24

const SHARING = {
  private: { label: '自分のみ', colorScheme: 'gray' },
  friends: { label: '友だち', colorScheme: 'primary' },
  team: { label: 'チーム', colorScheme: 'signal' },
} as const

// 15-minute time options: "00:00", "00:15", … "23:45". Used as datalist
// suggestions so the time field offers a dropdown yet stays free-text.
const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4)
  const m = (i % 4) * 15
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

// Event block colors per sharing state, aligned with the design system.
const EVENT_STYLE = {
  private: { bg: 'gray.100', accent: 'gray.400', text: 'gray.700', time: 'gray.500' },
  friends: { bg: 'primary.50', accent: 'primary.500', text: 'primary.800', time: 'primary.600' },
  team: { bg: 'signal.50', accent: 'signal.500', text: 'signal.800', time: 'signal.600' },
} as const

function startOfWeek(d: Date) {
  const dt = new Date(d)
  const day = dt.getDay()
  dt.setHours(0, 0, 0, 0)
  dt.setDate(dt.getDate() - day)
  return dt
}

function addDays(d: Date, days: number) {
  const dt = new Date(d)
  dt.setDate(dt.getDate() + days)
  return dt
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function minutesOfDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes()
}

// Local "YYYY-MM-DD" for date inputs (avoids the UTC shift of toISOString).
function toDateInput(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function hourLabel(h: number) {
  return `${String(h).padStart(2, '0')}:00`
}

// Does the event's [start, end) range touch the given calendar day?
function overlapsDay(ev: EventRow, day: Date) {
  const ds = new Date(day)
  ds.setHours(0, 0, 0, 0)
  const de = addDays(ds, 1)
  return new Date(ev.startAt) < de && new Date(ev.endAt) > ds
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

type Positioned = {
  ev: EventRow
  start: number // minutes from midnight (clamped to this day)
  end: number
  fromPrev: boolean // event began on an earlier day
  toNext: boolean // event continues into a later day
  colIndex: number
  colCount: number
}

/**
 * Pack one day's events into side-by-side columns, Google-Calendar style.
 * Each event is sliced to the portion that falls on `day`, so multi-day and
 * overnight events appear on every day they cover (clamped to midnight bounds).
 */
function layoutDay(day: Date, allEvents: EventRow[]): Positioned[] {
  const dayStart = new Date(day)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = addDays(dayStart, 1)

  const items = allEvents
    .map((ev) => {
      if (ev.isAllDay) return null // all-day events live in their own row
      const s = new Date(ev.startAt)
      const e = new Date(ev.endAt)
      // keep only events that overlap this day
      if (!(s < dayEnd && e > dayStart)) return null
      const start = s <= dayStart ? 0 : minutesOfDay(s)
      const rawEnd = e >= dayEnd ? 24 * 60 : minutesOfDay(e)
      const end = Math.min(Math.max(rawEnd, start + 20), 24 * 60) // min visible height
      return { ev, start, end, fromPrev: s < dayStart, toNext: e > dayEnd }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const result: Positioned[] = []
  let cluster: typeof items = []
  let clusterEnd = -1

  const flush = () => {
    const colEnds: number[] = [] // last end time placed in each column
    const colOf = new Map<EventRow, number>()
    for (const it of cluster) {
      let col = colEnds.findIndex((end) => it.start >= end)
      if (col === -1) {
        col = colEnds.length
        colEnds.push(it.end)
      } else {
        colEnds[col] = it.end
      }
      colOf.set(it.ev, col)
    }
    const colCount = colEnds.length
    for (const it of cluster) {
      result.push({ ...it, colIndex: colOf.get(it.ev)!, colCount })
    }
    cluster = []
    clusterEnd = -1
  }

  for (const it of items) {
    if (cluster.length && it.start >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.end)
  }
  if (cluster.length) flush()
  return result
}

export default function CalendarTab() {
  const { user, teams } = useAuth()
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()))
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const scrollRef = useRef<HTMLDivElement>(null)

  const { isOpen, onOpen, onClose } = useDisclosure()
  const [form, setForm] = useState({
    name: '',
    isAllDay: false,
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    eventLocation: '',
    sharingState: 'private',
  })
  // The 1-hour slot currently hovered in the time grid (Google-style ghost).
  const [hoverSlot, setHoverSlot] = useState<{ dayIso: string; hour: number } | null>(null)

  // Convert a mouse event over a day column into an hour (0–23).
  function hourFromPointer(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    return Math.max(0, Math.min(23, Math.floor(y / HOUR_HEIGHT)))
  }

  // Open the add modal prefilled with the clicked day + 1-hour slot.
  function openSlot(day: Date, hour: number) {
    const dateStr = toDateInput(day)
    setForm({
      name: '',
      isAllDay: false,
      startDate: dateStr,
      startTime: hourLabel(hour),
      endDate: dateStr,
      // 23:00 slot has no same-day end hour; leave blank so it defaults to +1h.
      endTime: hour < 23 ? hourLabel(hour + 1) : '',
      eventLocation: '',
      sharingState: 'private',
    })
    setHoverSlot(null)
    onOpen()
  }

  const teamIds = useMemo(() => teams.map((t) => t.id), [teams])

  useEffect(() => {
    fetchEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, teams])

  // Keep the "current time" line fresh.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // Scroll to ~7:00 on first mount so the morning is in view.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT - 12
  }, [])

  async function fetchEvents() {
    if (!teamIds || teamIds.length === 0) return setEvents([])
    setLoading(true)
    const wkStart = startOfWeek(anchor)
    const wkEnd = addDays(wkStart, 7)
    try {
      // Any event that *overlaps* the week, so multi-day / overnight events
      // that started before this week are still picked up.
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .in('teamId', teamIds)
        .lt('startAt', wkEnd.toISOString())
        .gt('endAt', wkStart.toISOString())
        .order('startAt', { ascending: true })

      if (error) {
        console.error('fetch events error', error)
        setEvents([])
      } else {
        setEvents((data as EventRow[]) || [])
      }
    } finally {
      setLoading(false)
    }
  }

  function prevWeek() {
    setAnchor((a) => addDays(a, -7))
  }

  function nextWeek() {
    setAnchor((a) => addDays(a, 7))
  }

  function goToday() {
    setAnchor(startOfWeek(new Date()))
  }

  function days() {
    const start = startOfWeek(anchor)
    return Array.from({ length: 7 }).map((_, i) => addDays(start, i))
  }

  const weekStart = startOfWeek(anchor)
  const weekEnd = addDays(weekStart, 6)
  const rangeLabel = `${weekStart.toLocaleDateString('ja-JP', {
    month: 'long',
    day: 'numeric',
  })} – ${weekEnd.toLocaleDateString('ja-JP', {
    month: weekStart.getMonth() === weekEnd.getMonth() ? undefined : 'long',
    day: 'numeric',
  })}`

  async function handleCreate() {
    if (!user) return
    if (!teams || teams.length === 0) return
    const teamId = teams[0].id

    let start: Date
    let end: Date
    if (form.isAllDay) {
      // Midnight of the start day .. midnight after the end day (half-open).
      start = new Date(`${form.startDate}T00:00`)
      const endBase = new Date(`${form.endDate || form.startDate}T00:00`)
      end = new Date(endBase.getTime() + 24 * 60 * 60 * 1000)
    } else {
      start = new Date(`${form.startDate}T${form.startTime}`)
      // Default the end to one hour after the start when it is left blank.
      const endRaw = new Date(`${form.endDate || form.startDate}T${form.endTime}`)
      end = isNaN(endRaw.getTime()) ? new Date(start.getTime() + 60 * 60 * 1000) : endRaw
    }
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error('invalid datetime')
      return
    }

    try {
      await supabase.from('events').insert({
        createdBy: user.id,
        teamId,
        name: form.name,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        isAllDay: form.isAllDay,
        eventLocation: form.eventLocation || null,
        sharingState: form.sharingState as EventRow['sharingState'],
      })
      setForm({
        name: '',
        isAllDay: false,
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        eventLocation: '',
        sharingState: 'private',
      })
      onClose()
      fetchEvents()
    } catch (err) {
      console.error('create event error', err)
    }
  }

  async function handleDelete(id: string) {
    try {
      await supabase.from('events').delete().eq('id', id)
      fetchEvents()
    } catch (err) {
      console.error('delete event error', err)
    }
  }

  const week = days()
  const nowMinutes = minutesOfDay(now)

  return (
    <Box>
      {/* Toolbar */}
      <Flex
        justify="space-between"
        align={{ base: 'stretch', md: 'center' }}
        direction={{ base: 'column', md: 'row' }}
        gap={3}
        mb={5}
      >
        <HStack spacing={3}>
          <HStack
            spacing={0}
            bg="paper-2"
            border="1px solid"
            borderColor="gray.200"
            borderRadius="lg"
            overflow="hidden"
          >
            <IconButton
              aria-label="前の週"
              icon={<ChevronLeftIcon boxSize={5} />}
              variant="ghost"
              borderRadius={0}
              onClick={prevWeek}
            />
            <Box w="1px" h={6} bg="gray.200" />
            <IconButton
              aria-label="次の週"
              icon={<ChevronRightIcon boxSize={5} />}
              variant="ghost"
              borderRadius={0}
              onClick={nextWeek}
            />
          </HStack>
          <Button variant="secondary" onClick={goToday}>
            今日
          </Button>
          <Box>
            <Heading size="md" letterSpacing="tight">
              {rangeLabel}
            </Heading>
            <Text fontSize="xs" color="gray.500" fontFamily="mono">
              {weekStart.getFullYear()}
            </Text>
          </Box>
        </HStack>

        <Button
          variant="signal"
          leftIcon={<AddIcon boxSize={3} />}
          onClick={() => {
            setForm({
              name: '',
              isAllDay: false,
              startDate: '',
              startTime: '',
              endDate: '',
              endTime: '',
              eventLocation: '',
              sharingState: 'private',
            })
            onOpen()
          }}
        >
          予定を追加
        </Button>
      </Flex>

      {loading ? (
        <Center py={20}>
          <Spinner color="primary.500" thickness="3px" />
        </Center>
      ) : (
        <Box
          bg="paper-2"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="xl"
          overflow="hidden"
        >
          <Box overflowX="auto">
            <Box minW="760px">
              {/* Day headers */}
              <Flex borderBottom="1px solid" borderColor="gray.200">
                <Box w={`${GUTTER}px`} flexShrink={0} />
                {week.map((d) => {
                  const today = isSameDay(d, now)
                  const dow = d.getDay()
                  return (
                    <VStack
                      key={d.toISOString()}
                      flex={1}
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
                      <Center
                        boxSize={8}
                        borderRadius="full"
                        bg={today ? 'signal.500' : 'transparent'}
                      >
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

              {/* All-day row — only shown when there are all-day events */}
              {events.some((e) => e.isAllDay) && (
                <Flex borderBottom="1px solid" borderColor="gray.200" bg="gray.50">
                  <Center w={`${GUTTER}px`} flexShrink={0} px={1}>
                    <Text fontSize="10px" fontWeight="bold" color="gray.400" textAlign="center">
                      終日
                    </Text>
                  </Center>
                  {week.map((d) => {
                    const allDay = events.filter((e) => e.isAllDay && overlapsDay(e, d))
                    return (
                      <VStack
                        key={d.toISOString()}
                        flex={1}
                        spacing={1}
                        align="stretch"
                        p={1}
                        minH="32px"
                        borderLeft="1px solid"
                        borderColor="gray.100"
                      >
                        {allDay.map((ev) => {
                          const style =
                            EVENT_STYLE[ev.sharingState as keyof typeof EVENT_STYLE] ??
                            EVENT_STYLE.private
                          const mine = user && ev.createdBy === user.id
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
                              <Text
                                fontSize="xs"
                                fontWeight="600"
                                color={style.text}
                                noOfLines={1}
                              >
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
                                  onClick={() => handleDelete(ev.id)}
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

              {/* Scrollable time grid */}
              <Flex
                ref={scrollRef}
                overflowY="auto"
                maxH={{ base: '60vh', md: 'calc(100vh - 300px)' }}
                position="relative"
              >
                {/* Time gutter */}
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

                {/* Day columns with hour lines */}
                <Flex
                  flex={1}
                  position="relative"
                  h={`${TOTAL_HEIGHT}px`}
                  backgroundImage={`repeating-linear-gradient(to bottom, var(--line) 0, var(--line) 1px, transparent 1px, transparent ${HOUR_HEIGHT}px)`}
                >
                  {week.map((d) => {
                    const today = isSameDay(d, now)
                    const positioned = layoutDay(d, events)
                    const dayIso = d.toISOString()
                    const ghostHour = hoverSlot?.dayIso === dayIso ? hoverSlot.hour : null
                    return (
                      <Box
                        key={dayIso}
                        flex={1}
                        position="relative"
                        borderLeft="1px solid"
                        borderColor="gray.100"
                        cursor="pointer"
                        onMouseMove={(e) => {
                          const hour = hourFromPointer(e)
                          if (hoverSlot?.dayIso !== dayIso || hoverSlot.hour !== hour) {
                            setHoverSlot({ dayIso, hour })
                          }
                        }}
                        onMouseLeave={() =>
                          setHoverSlot((s) => (s?.dayIso === dayIso ? null : s))
                        }
                        onClick={(e) => openSlot(d, hourFromPointer(e))}
                      >
                        {/* Ghost slot following the cursor (1-hour preview) */}
                        {ghostHour !== null && (
                          <Box
                            position="absolute"
                            top={`${ghostHour * HOUR_HEIGHT}px`}
                            left="2px"
                            right="2px"
                            height={`${HOUR_HEIGHT - 2}px`}
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
                              + {hourLabel(ghostHour)}
                            </Text>
                          </Box>
                        )}

                        {positioned.map(({ ev, start, end, fromPrev, toNext, colIndex, colCount }) => {
                          const style =
                            EVENT_STYLE[ev.sharingState as keyof typeof EVENT_STYLE] ??
                            EVENT_STYLE.private
                          const mine = user && ev.createdBy === user.id
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
                                      handleDelete(ev.id)
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

                        {/* Current time indicator */}
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
            </Box>
          </Box>
        </Box>
      )}

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay bg="blackAlpha.500" backdropFilter="blur(2px)" />
        <ModalContent mx={4}>
          <ModalHeader fontFamily="heading">予定を追加</ModalHeader>
          <ModalCloseButton borderRadius="full" />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <FormControl>
                <FormLabel>タイトル</FormLabel>
                <Input
                  placeholder="例: チームランチ"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </FormControl>

              <FormControl display="flex" alignItems="center" justifyContent="space-between">
                <FormLabel mb={0} htmlFor="all-day">
                  終日
                </FormLabel>
                <Switch
                  id="all-day"
                  colorScheme="primary"
                  isChecked={form.isAllDay}
                  onChange={(e) => setForm({ ...form, isAllDay: e.target.checked })}
                />
              </FormControl>

              {/* 15-minute suggestions shared by both time fields; still free-text. */}
              <datalist id="time-options-15">
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>

              <FormControl>
                <FormLabel>開始</FormLabel>
                <HStack spacing={2}>
                  <ChakraInput
                    type="date"
                    flex="1.4"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                  {!form.isAllDay && (
                    <ChakraInput
                      type="time"
                      step={900}
                      list="time-options-15"
                      placeholder="HH:MM"
                      flex="1"
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    />
                  )}
                </HStack>
              </FormControl>

              <FormControl>
                <FormLabel>終了</FormLabel>
                <HStack spacing={2}>
                  <ChakraInput
                    type="date"
                    flex="1.4"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                  {!form.isAllDay && (
                    <ChakraInput
                      type="time"
                      step={900}
                      list="time-options-15"
                      placeholder="HH:MM"
                      flex="1"
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    />
                  )}
                </HStack>
              </FormControl>

              <FormControl>
                <FormLabel>場所</FormLabel>
                <Textarea
                  rows={2}
                  placeholder="集合場所やメモ"
                  value={form.eventLocation}
                  onChange={(e) => setForm({ ...form, eventLocation: e.target.value })}
                />
              </FormControl>

              <FormControl>
                <FormLabel>
                  公開範囲{' '}
                  <Badge
                    ml={1}
                    colorScheme={SHARING[form.sharingState as keyof typeof SHARING].colorScheme}
                    variant="subtle"
                  >
                    {SHARING[form.sharingState as keyof typeof SHARING].label}
                  </Badge>
                </FormLabel>
                <Select
                  value={form.sharingState}
                  onChange={(e) => setForm({ ...form, sharingState: e.target.value })}
                >
                  <option value="private">自分のみ</option>
                  <option value="friends">友だち</option>
                  <option value="team">チーム</option>
                </Select>
              </FormControl>
            </VStack>
          </ModalBody>

          <ModalFooter gap={2}>
            <Button variant="ghost" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              variant="signal"
              onClick={handleCreate}
              isDisabled={!form.name || !form.startDate || (!form.isAllDay && !form.startTime)}
            >
              作成する
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}