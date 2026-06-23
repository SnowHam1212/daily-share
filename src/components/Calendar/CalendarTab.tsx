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
} from '@chakra-ui/react'
import { ArrowLeftIcon, ArrowRightIcon, AddIcon, DeleteIcon } from '@chakra-ui/icons'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { Database } from '../../types/database'

type EventRow = Database['public']['Tables']['events']['Row']

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

export default function CalendarTab() {
  const { user, teams } = useAuth()
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()))
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(false)

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
      <HStack justify="space-between" mb={4}>
        <HStack>
          <IconButton aria-label="prev" icon={<ArrowLeftIcon />} onClick={prevWeek} />
          <IconButton aria-label="next" icon={<ArrowRightIcon />} onClick={nextWeek} />
          <Heading size="md">Week of {anchor.toDateString()}</Heading>
        </HStack>
        <HStack>
          <Button leftIcon={<AddIcon />} onClick={onOpen}>Add Event</Button>
        </HStack>
      </HStack>

      {loading ? (
        <Spinner />
      ) : (
        <Grid templateColumns="repeat(7, 1fr)" gap={4}>
          {days().map((d) => (
            <Box key={d.toISOString()} borderWidth="1px" borderRadius="md" p={3} minH="120px">
              <Heading size="sm">{d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</Heading>
              <VStack align="stretch" mt={2} spacing={2}>
                {eventsForDay(d).map((ev) => (
                  <Box key={ev.id} p={2} bg="gray.50" borderRadius="md">
                    <HStack justify="space-between">
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="bold">{ev.name}</Text>
                        <Text fontSize="sm">{new Date(ev.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(ev.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                        {ev.eventLocation && <Text fontSize="sm">{ev.eventLocation}</Text>}
                      </VStack>
                      {user && ev.createdBy === user.id && (
                        <IconButton aria-label="delete" size="sm" icon={<DeleteIcon />} onClick={() => handleDelete(ev.id)} />
                      )}
                    </HStack>
                  </Box>
                ))}
              </VStack>
            </Box>
          ))}
        </Grid>
      )}

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add Event</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl mb={3}>
              <FormLabel>Name</FormLabel>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormControl>

            <FormControl mb={3}>
              <FormLabel>Start</FormLabel>
              <Input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
            </FormControl>

            <FormControl mb={3}>
              <FormLabel>End</FormLabel>
              <Input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
            </FormControl>

            <FormControl mb={3}>
              <FormLabel>Location</FormLabel>
              <Textarea value={form.eventLocation} onChange={(e) => setForm({ ...form, eventLocation: e.target.value })} />
            </FormControl>

            <FormControl mb={3}>
              <FormLabel>Sharing</FormLabel>
              <Select value={form.sharingState} onChange={(e) => setForm({ ...form, sharingState: e.target.value })}>
                <option value="private">Private</option>
                <option value="friends">Friends</option>
                <option value="team">Team</option>
              </Select>
            </FormControl>
          </ModalBody>

          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  )
}
