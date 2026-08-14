import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Flex,
  Heading,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerBody,
  DrawerHeader,
  DrawerCloseButton,
  useDisclosure,
  useToast,
  Spinner,
  Center,
} from '@chakra-ui/react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  RepeatIcon,
  HamburgerIcon,
  AddIcon,
  DownloadIcon,
} from '@chakra-ui/icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { EventModal } from './EventModal'
import { ImportModal } from './ImportModal'
import { TimeGridView } from './TimeGridView'
import { MonthView } from './MonthView'
import { CalendarSidebar, CalendarSidebarBody } from './CalendarSidebar'
import {
  EMPTY_FORM,
  eventToForm,
  eventsForRange,
  formToEventValues,
  startOfWeek,
  startOfDay,
  addDays,
  addMonths,
  monthGridDays,
  toDateInput,
  minuteToTime,
  type CalendarView,
  type EventForm,
  type EventRow,
  type SharingState,
} from './calendarUtils'

const VIEW_LABEL: Record<CalendarView, string> = { day: '日', week: '週', month: '月' }

export default function CalendarTab() {
  const { user, teams } = useAuth()
  const [view, setView] = useState<CalendarView>('week')
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [filters, setFilters] = useState<Set<SharingState>>(
    () => new Set<SharingState>(['private', 'friends', 'team']),
  )
  // Teams the user has *unchecked* in the team filter. Empty = show all teams.
  const [hiddenTeams, setHiddenTeams] = useState<Set<string>>(() => new Set())

  const { isOpen, onOpen, onClose } = useDisclosure()
  // Mobile drawer that hosts the sidebar (create / mini-calendar / filters).
  const mobileNav = useDisclosure()
  const importer = useDisclosure()
  const toast = useToast()
  const [form, setForm] = useState<EventForm>(EMPTY_FORM)
  // id of the event being edited; null when creating a new one
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function closeModal() {
    setEditingId(null)
    onClose()
  }

  const teamIds = useMemo(() => teams.map((t) => t.id), [teams])
  // 新規作成の既定の保存先。チームに入っていなければ個人（null）。
  const defaultTeamId = teams.length > 0 ? teams[0].id : null

  // 新規作成用の空フォーム。
  function blankForm(overrides?: Partial<EventForm>): EventForm {
    return { ...EMPTY_FORM, teamId: defaultTeamId, ...overrides }
  }

  // The date range currently visible, depending on the view.
  const [rangeStart, rangeEnd] = useMemo<[Date, Date]>(() => {
    if (view === 'day') return [startOfDay(anchor), addDays(startOfDay(anchor), 1)]
    if (view === 'week') return [startOfWeek(anchor), addDays(startOfWeek(anchor), 7)]
    const grid = monthGridDays(anchor)
    return [grid[0], addDays(grid[grid.length - 1], 1)]
  }, [view, anchor])

  useEffect(() => {
    fetchEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart.getTime(), rangeEnd.getTime(), teamIds.join(',')])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // `silent` re-fetches without the full-grid spinner (used by the 更新 button).
  async function fetchEvents(opts?: { silent?: boolean }) {
    if (!user) return setEvents([])
    if (opts?.silent) setRefreshing(true)
    else setLoading(true)
    try {
      // (1) Non-recurring events (and recurring masters) overlapping the range.
      // (2) Recurring masters that started before the range but recur into it.
      // Merge + de-dupe; occurrences are expanded client-side via eventsForRange.
      //
      // チームでの絞り込みはしない。RLS（events_select）が「自分の個人予定 ＋
      // 所属チームの予定」だけを返すので、チーム未所属でも個人予定が見える。
      const [inRange, recurringMasters] = await Promise.all([
        supabase
          .from('events')
          .select('*')
          .lt('startAt', rangeEnd.toISOString())
          .gt('endAt', rangeStart.toISOString())
          .order('startAt', { ascending: true }),
        supabase
          .from('events')
          .select('*')
          .neq('recurrence', 'none')
          .lt('startAt', rangeEnd.toISOString()),
      ])
      const error = inRange.error || recurringMasters.error
      if (error) {
        console.error('fetch events error', error)
        if (opts?.silent) toast({ status: 'error', title: '更新できませんでした', description: error.message })
        setEvents([])
      } else {
        const byId = new Map<string, EventRow>()
        for (const e of [...(inRange.data ?? []), ...(recurringMasters.data ?? [])] as EventRow[]) {
          byId.set(e.id, e)
        }
        setEvents(Array.from(byId.values()))
      }
    } finally {
      if (opts?.silent) setRefreshing(false)
      else setLoading(false)
    }
  }

  function handleRefresh() {
    void fetchEvents({ silent: true })
  }

  const visibleEvents = useMemo(
    () =>
      eventsForRange(events, rangeStart, rangeEnd).filter(
        (e) =>
          filters.has(e.sharingState as SharingState) &&
          // 個人予定（teamId なし）はチームの絞り込み対象外。
          (e.teamId === null || !hiddenTeams.has(e.teamId)),
      ),
    [events, filters, hiddenTeams, rangeStart, rangeEnd],
  )

  const days = useMemo(() => {
    if (view === 'day') return [startOfDay(anchor)]
    const start = startOfWeek(anchor)
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }, [view, anchor])

  function goPrev() {
    if (view === 'day') setAnchor((a) => addDays(a, -1))
    else if (view === 'week') setAnchor((a) => addDays(a, -7))
    else setAnchor((a) => addMonths(a, -1))
  }
  function goNext() {
    if (view === 'day') setAnchor((a) => addDays(a, 1))
    else if (view === 'week') setAnchor((a) => addDays(a, 7))
    else setAnchor((a) => addMonths(a, 1))
  }
  function goToday() {
    setAnchor(startOfDay(new Date()))
  }

  function toggleFilter(s: SharingState) {
    setFilters((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  function toggleTeam(teamId: string) {
    setHiddenTeams((prev) => {
      const next = new Set(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.add(teamId)
      return next
    })
  }

  const rangeLabel = useMemo(() => {
    if (view === 'day') {
      return anchor.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      })
    }
    if (view === 'week') {
      const ws = startOfWeek(anchor)
      const we = addDays(ws, 6)
      const sameMonth = ws.getMonth() === we.getMonth()
      return `${ws.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })} – ${we.toLocaleDateString(
        'ja-JP',
        { month: sameMonth ? undefined : 'long', day: 'numeric' },
      )}`
    }
    return `${anchor.getFullYear()}年 ${anchor.getMonth() + 1}月`
  }, [view, anchor])

  function openBlank() {
    setEditingId(null)
    setForm(blankForm())
    onOpen()
  }

  function openSlot(day: Date, minute: number) {
    const dateStr = toDateInput(day)
    const endMinute = minute + 60
    setEditingId(null)
    setForm(
      blankForm({
        startDate: dateStr,
        startTime: minuteToTime(minute),
        endDate: dateStr,
        endTime: endMinute <= 24 * 60 ? minuteToTime(endMinute) : '',
      }),
    )
    onOpen()
  }

  function openAllDay(day: Date) {
    const dateStr = toDateInput(day)
    setEditingId(null)
    setForm(blankForm({ isAllDay: true, startDate: dateStr, endDate: dateStr }))
    onOpen()
  }

  function openEdit(ev: EventRow) {
    setEditingId(ev.id)
    setForm(eventToForm(ev))
    onOpen()
  }

  function openDayView(day: Date) {
    setAnchor(startOfDay(day))
    setView('day')
  }

  async function handleSubmit() {
    if (!user) {
      toast({ status: 'error', title: 'ログインが必要です' })
      return
    }

    // チームに入っていなくても予定は作れる（teamId = null の個人予定になる）。
    const result = formToEventValues(form)
    if (!result.ok) {
      toast({ status: 'error', title: result.error })
      return
    }

    setSaving(true)
    const { error } = editingId
      ? await supabase.from('events').update(result.values).eq('id', editingId)
      : await supabase.from('events').insert({ ...result.values, createdBy: user.id })
    setSaving(false)

    if (error) {
      console.error('save event error', error)
      toast({
        status: 'error',
        title: editingId ? '予定を更新できませんでした' : '予定を追加できませんでした',
        description: error.message,
        duration: 8000,
        isClosable: true,
      })
      return
    }

    setForm(blankForm())
    closeModal()
    fetchEvents()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) {
      toast({ status: 'error', title: '削除できませんでした', description: error.message })
      return
    }
    fetchEvents()
  }

  return (
    <Flex align="start" gap={0}>
      <CalendarSidebar
        anchor={anchor}
        now={now}
        onPickDate={(d) => setAnchor(startOfDay(d))}
        onCreate={openBlank}
        filters={filters}
        onToggleFilter={toggleFilter}
        teams={teams}
        hiddenTeams={hiddenTeams}
        onToggleTeam={toggleTeam}
      />

      <Box flex={1} minW={0}>
        {/* Toolbar */}
        <Flex
          justify="space-between"
          align={{ base: 'stretch', md: 'center' }}
          direction={{ base: 'column', md: 'row' }}
          gap={3}
          mb={5}
        >
          <HStack spacing={3}>
            <IconButton
              aria-label="メニュー"
              icon={<HamburgerIcon boxSize={5} />}
              variant="secondary"
              display={{ base: 'inline-flex', lg: 'none' }}
              onClick={mobileNav.onOpen}
            />
            <HStack
              spacing={0}
              bg="paper-2"
              border="1px solid"
              borderColor="gray.200"
              borderRadius="lg"
              overflow="hidden"
            >
              <IconButton aria-label="前へ" icon={<ChevronLeftIcon boxSize={5} />} variant="ghost" borderRadius={0} onClick={goPrev} />
              <Box w="1px" h={6} bg="gray.200" />
              <IconButton aria-label="次へ" icon={<ChevronRightIcon boxSize={5} />} variant="ghost" borderRadius={0} onClick={goNext} />
            </HStack>
            <Button variant="secondary" onClick={goToday}>
              今日
            </Button>
            <Heading size="md" letterSpacing="tight" noOfLines={1}>
              {rangeLabel}
            </Heading>
          </HStack>

          <HStack spacing={2}>
            <Button
              variant="secondary"
              leftIcon={<DownloadIcon />}
              onClick={importer.onOpen}
              display={{ base: 'none', md: 'inline-flex' }}
            >
              取り込み
            </Button>
            <IconButton
              aria-label="外部カレンダーから取り込む"
              icon={<DownloadIcon />}
              variant="secondary"
              display={{ base: 'inline-flex', md: 'none' }}
              onClick={importer.onOpen}
            />
            <Button
              variant="secondary"
              leftIcon={<RepeatIcon />}
              onClick={handleRefresh}
              isLoading={refreshing}
              loadingText="更新中"
            >
              更新
            </Button>
            <Menu>
              <MenuButton as={Button} variant="secondary" rightIcon={<ChevronDownIcon />}>
                {VIEW_LABEL[view]}
              </MenuButton>
              <MenuList minW="120px">
                {(Object.keys(VIEW_LABEL) as CalendarView[]).map((v) => (
                  <MenuItem
                    key={v}
                    onClick={() => setView(v)}
                    fontWeight={view === v ? '700' : '400'}
                    color={view === v ? 'primary.600' : 'gray.700'}
                  >
                    {VIEW_LABEL[v]}表示
                  </MenuItem>
                ))}
              </MenuList>
            </Menu>
          </HStack>
        </Flex>

        {loading ? (
          <Center py={20}>
            <Spinner color="primary.500" thickness="3px" />
          </Center>
        ) : view === 'month' ? (
          <MonthView
            anchor={anchor}
            events={visibleEvents}
            now={now}
            onDayClick={openDayView}
            onEventClick={openEdit}
          />
        ) : (
          <TimeGridView
            days={days}
            events={visibleEvents}
            now={now}
            currentUserId={user?.id}
            onSlotClick={openSlot}
            onAllDayClick={openAllDay}
            onEventClick={openEdit}
            onDelete={handleDelete}
          />
        )}
      </Box>

      <EventModal
        isOpen={isOpen}
        onClose={closeModal}
        form={form}
        setForm={setForm}
        onSubmit={handleSubmit}
        isEditing={!!editingId}
        teams={teams}
        isSaving={saving}
      />

      <ImportModal
        isOpen={importer.isOpen}
        onClose={importer.onClose}
        teams={teams}
        onImported={() => fetchEvents()}
      />

      {/* Mobile: sidebar contents in a drawer */}
      <Drawer isOpen={mobileNav.isOpen} placement="left" onClose={mobileNav.onClose} size="xs">
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader fontFamily="heading">カレンダー</DrawerHeader>
          <DrawerBody pb={6}>
            <CalendarSidebarBody
              anchor={anchor}
              now={now}
              onPickDate={(d) => {
                setAnchor(startOfDay(d))
                mobileNav.onClose()
              }}
              onCreate={() => {
                mobileNav.onClose()
                openBlank()
              }}
              filters={filters}
              onToggleFilter={toggleFilter}
              teams={teams}
              hiddenTeams={hiddenTeams}
              onToggleTeam={toggleTeam}
            />
          </DrawerBody>
        </DrawerContent>
      </Drawer>

      {/* Mobile: floating "create" button */}
      <IconButton
        aria-label="予定を作成"
        icon={<AddIcon />}
        onClick={openBlank}
        display={{ base: 'inline-flex', lg: 'none' }}
        position="fixed"
        bottom={6}
        right={6}
        zIndex={20}
        boxSize={14}
        borderRadius="full"
        bg="signal.500"
        color="white"
        boxShadow="lg"
        _hover={{ bg: 'signal.600' }}
        _active={{ bg: 'signal.700' }}
      />
    </Flex>
  )
}
