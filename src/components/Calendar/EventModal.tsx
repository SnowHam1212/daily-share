import { useState } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  FormErrorMessage,
  Textarea,
  Select,
  Box,
  Alert,
  AlertIcon,
} from '@chakra-ui/react'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { Database } from '../../types/database'

type EventRow = Database['public']['Tables']['events']['Row']
type EventInsert = Database['public']['Tables']['events']['Insert']

// 💡 フォーム専用の型を定義（sharingStateにはSupabaseの型をそのまま流用）
interface FormState {
  name: string
  startAt: string
  endAt: string
  eventLocation: string
  sharingState: EventRow['sharingState']
}

interface EventModalProps {
  isOpen: boolean
  onClose: () => void
  teamId: string
  userId: string | undefined
  onEventCreated?: () => void
}

export function EventModal({ isOpen, onClose, teamId, userId, onEventCreated }: EventModalProps) {
  // 💡 useState<FormState> で型を明示。これでform全体の型がブレなくなります
  const [form, setForm] = useState<FormState>({
    name: '',
    startAt: '',
    endAt: '',
    eventLocation: '',
    sharingState: 'team',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  function validateForm(): boolean {
    const newErrors: Record<string, string> = {}

    if (!form.name.trim()) {
      newErrors.name = 'Title is required'
    }

    if (!form.startAt) {
      newErrors.startAt = 'Start time is required'
    }

    if (!form.endAt) {
      newErrors.endAt = 'End time is required'
    }

    if (form.startAt && form.endAt) {
      const startTime = new Date(form.startAt).getTime()
      const endTime = new Date(form.endAt).getTime()
      if (startTime >= endTime) {
        newErrors.endAt = 'End time must be after start time'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleCreate() {
    if (!validateForm() || !userId) return

    setLoading(true)
    setSubmitError('')

    try {
      const eventData: EventInsert = {
        createdBy: userId,
        teamId,
        name: form.name.trim(),
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        eventLocation: form.eventLocation || null,
        sharingState: form.sharingState, // 💡 form.sharingState自体が正しい型になったので、ここの「as」は不要になりました！
      }

      const { error } = await supabase.from('events').insert(eventData)

      if (error) {
        setSubmitError(error.message)
        return
      }

      setForm({ name: '', startAt: '', endAt: '', eventLocation: '', sharingState: 'team' })
      setErrors({})
      onEventCreated?.()
      onClose()
    } catch (err) {
      console.error('create event error', err)
      setSubmitError('Failed to create event')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setForm({ name: '', startAt: '', endAt: '', eventLocation: '', sharingState: 'team' })
    setErrors({})
    setSubmitError('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add Event</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {submitError && (
            <Alert status="error" mb={4} borderRadius="md">
              <AlertIcon />
              {submitError}
            </Alert>
          )}

          <FormControl mb={3} isInvalid={Boolean(errors.name)}>
            <FormLabel>Title *</FormLabel>
            <Input
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value })
                if (errors.name) {
                  setErrors({ ...errors, name: '' })
                }
              }}
              placeholder="Event title"
            />
            {errors.name && <FormErrorMessage>{errors.name}</FormErrorMessage>}
          </FormControl>

          <FormControl mb={3} isInvalid={Boolean(errors.startAt)}>
            <FormLabel>Start Time *</FormLabel>
            <Input
              type="datetime-local"
              value={form.startAt}
              onChange={(e) => {
                setForm({ ...form, startAt: e.target.value })
                if (errors.startAt) {
                  setErrors({ ...errors, startAt: '' })
                }
              }}
            />
            {errors.startAt && <FormErrorMessage>{errors.startAt}</FormErrorMessage>}
          </FormControl>

          <FormControl mb={3} isInvalid={Boolean(errors.endAt)}>
            <FormLabel>End Time *</FormLabel>
            <Input
              type="datetime-local"
              value={form.endAt}
              onChange={(e) => {
                setForm({ ...form, endAt: e.target.value })
                if (errors.endAt) {
                  setErrors({ ...errors, endAt: '' })
                }
              }}
            />
            {errors.endAt && <FormErrorMessage>{errors.endAt}</FormErrorMessage>}
          </FormControl>

          <Box mb={3} pb={3} borderBottomWidth="1px" borderBottomColor="gray.200">
            <FormControl mb={3}>
              <FormLabel>Location</FormLabel>
              <Textarea
                value={form.eventLocation}
                onChange={(e) => setForm({ ...form, eventLocation: e.target.value })}
                placeholder="Event location (optional)"
                resize="vertical"
                minH="60px"
              />
            </FormControl>

            <FormControl>
              <FormLabel>Sharing</FormLabel>
              <Select
                value={form.sharingState}
                // 💡 e.target.value は string として入ってくるため、ここだけ Supabase の型でキャストしてあげれば完璧です
                onChange={(e) => setForm({ ...form, sharingState: e.target.value as EventRow['sharingState'] })}
              >
                <option value="private">Private</option>
                <option value="friends">Friends</option>
                <option value="team">Team</option>
              </Select>
            </FormControl>
          </Box>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} isLoading={loading}>
            Create
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}