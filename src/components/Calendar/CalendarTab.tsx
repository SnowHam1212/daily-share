import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Grid,
  Heading,
  Text,
  HStack,
  VStack,
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Select,
  Textarea,
  Spinner,
  Flex,
  Badge,
  Center,
} from '@chakra-ui/react'
import { ChevronLeftIcon, ChevronRightIcon, AddIcon, DeleteIcon } from '@chakra-ui/icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { Database } from '../../types/database'

type EventRow = Database['public']['Tables']['events']['Row']

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

const SHARING = {
  private: { label: '自分のみ', colorScheme: 'gray' },
  friends: { label: '友だち', colorScheme: 'primary' },
  team: { label: 'チーム', colorScheme: 'signal' },
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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

export default function CalendarTab() {
  const { user, teams } = useAuth()
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()))
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(false)
  const today = new Date()

  const { isOpen, onOpen, onClose } = useDisclosure()
  const [form, setForm] = useState({
    name: '',
    startAt: '',
    endAt: '',
    eventLocation: '',
    sharingState: 'private',
  })

  const teamIds = useMemo(() => teams.map((t) => t.id), [teams])

  useEffect(() => {
    fetchEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, teams])

  async function fetchEvents() {
    if (!teamIds || teamIds.length === 0) return setEvents([])
    setLoading(true)
    const wkStart = startOfWeek(anchor)
    const wkEnd = addDays(wkStart, 7)
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .in('teamId', teamIds)
        .gte('startAt', wkStart.toISOString())
        .lt('startAt', wkEnd.toISOString())
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

  function eventsForDay(d: Date) {
    const dayStart = new Date(d)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(d)
    dayEnd.setHours(23, 59, 59, 999)
    return events.filter((e) => {
      const s = new Date(e.startAt)
      return s >= dayStart && s <= dayEnd
    })
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
    try {
      await supabase.from('events').insert({
        createdBy: user.id,
        teamId,
        name: form.name,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        eventLocation: form.eventLocation || null,
        sharingState: form.sharingState as EventRow['sharingState'],
      })
      setForm({ name: '', startAt: '', endAt: '', eventLocation: '', sharingState: 'private' })
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
          <Button variant="secondary" onClick={goToday} size="sm" h={11}>
            今週
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

        <Button variant="signal" leftIcon={<AddIcon boxSize={3} />} onClick={onOpen}>
          予定を追加
        </Button>
      </Flex>

      {loading ? (
        <Center py={20}>
          <Spinner color="primary.500" thickness="3px" />
        </Center>
      ) : (
        <Grid templateColumns={{ base: '1fr', md: 'repeat(7, 1fr)' }} gap={3}>
          {days().map((d) => {
            const isToday = isSameDay(d, today)
            const dow = d.getDay()
            const dayEvents = eventsForDay(d)
            return (
              <Box
                key={d.toISOString()}
                bg="paper-2"
                borderWidth="1px"
                borderColor={isToday ? 'signal.300' : 'gray.200'}
                borderRadius="xl"
                p={3}
                minH={{ base: 'auto', md: '160px' }}
                boxShadow={isToday ? 'sm' : 'none'}
                transition="border-color 0.15s"
                _hover={{ borderColor: isToday ? 'signal.400' : 'gray.300' }}
              >
                <Flex align="center" justify="space-between" mb={2}>
                  <HStack spacing={1.5}>
                    <Text
                      fontSize="xs"
                      fontWeight="bold"
                      color={
                        dow === 0 ? 'danger.500' : dow === 6 ? 'primary.600' : 'gray.400'
                      }
                    >
                      {WEEKDAYS[dow]}
                    </Text>
                    <Text
                      fontFamily="heading"
                      fontWeight="700"
                      fontSize="lg"
                      color={isToday ? 'signal.600' : 'gray.900'}
                      lineHeight="1"
                    >
                      {d.getDate()}
                    </Text>
                  </HStack>
                  {isToday && <Box className="presence-dot" />}
                </Flex>

                <VStack align="stretch" spacing={1.5}>
                  {dayEvents.map((ev) => {
                    const sharing = SHARING[ev.sharingState as keyof typeof SHARING] ?? SHARING.private
                    const mine = user && ev.createdBy === user.id
                    return (
                      <Box
                        key={ev.id}
                        role="group"
                        p={2}
                        bg="paper"
                        borderRadius="md"
                        borderLeft="3px solid"
                        borderLeftColor={`${sharing.colorScheme}.400`}
                      >
                        <Flex justify="space-between" align="start" gap={1}>
                          <Text fontWeight="600" fontSize="sm" noOfLines={2} color="gray.900">
                            {ev.name}
                          </Text>
                          {mine && (
                            <IconButton
                              aria-label="削除"
                              size="xs"
                              variant="ghost"
                              color="gray.400"
                              icon={<DeleteIcon />}
                              opacity={0}
                              _groupHover={{ opacity: 1 }}
                              _hover={{ color: 'danger.500', bg: 'danger.50' }}
                              onClick={() => handleDelete(ev.id)}
                            />
                          )}
                        </Flex>
                        <Text fontSize="xs" fontFamily="mono" color="gray.500" mt={0.5}>
                          {formatTime(ev.startAt)}–{formatTime(ev.endAt)}
                        </Text>
                        {ev.eventLocation && (
                          <Text fontSize="xs" color="gray.500" noOfLines={1} mt={0.5}>
                            📍 {ev.eventLocation}
                          </Text>
                        )}
                      </Box>
                    )
                  })}
                </VStack>
              </Box>
            )
          })}
        </Grid>
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

              <HStack spacing={3} align="start">
                <FormControl>
                  <FormLabel>開始</FormLabel>
                  <Input
                    type="datetime-local"
                    value={form.startAt}
                    onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>終了</FormLabel>
                  <Input
                    type="datetime-local"
                    value={form.endAt}
                    onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                  />
                </FormControl>
              </HStack>

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
            <Button variant="signal" onClick={handleCreate} isDisabled={!form.name || !form.startAt}>
              作成する
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
