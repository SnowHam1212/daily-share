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
  Select,
  Textarea,
  HStack,
  VStack,
  Badge,
  Switch,
  Text,
  Input as ChakraInput,
} from '@chakra-ui/react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { SHARING, RECURRENCE_LABEL, TIME_OPTIONS, viewerTimeZone, type EventForm, type SharingState } from './calendarUtils'

type ModalTeam = { id: string; teamName: string }

interface EventModalProps {
  isOpen: boolean
  onClose: () => void
  form: EventForm
  setForm: (f: EventForm) => void
  onSubmit: () => void
  isEditing?: boolean
  teams?: ModalTeam[]
  isSaving?: boolean
}

// 保存先の <option> の値。空文字は個人（teamId = null）。
const PERSONAL_VALUE = ''

export function EventModal({
  isOpen,
  onClose,
  form,
  setForm,
  onSubmit,
  isEditing,
  teams = [],
  isSaving,
}: EventModalProps) {
  const sharing = SHARING[form.sharingState as SharingState] ?? SHARING.private
  const isPersonal = form.teamId === null
  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay bg="blackAlpha.500" backdropFilter="blur(2px)" />
      <ModalContent mx={4}>
        <ModalHeader fontFamily="heading">{isEditing ? '予定を編集' : '予定を追加'}</ModalHeader>
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

            {teams.length > 0 && (
              <FormControl>
                <FormLabel>保存先</FormLabel>
                <Select
                  value={form.teamId ?? PERSONAL_VALUE}
                  onChange={(e) => {
                    const teamId = e.target.value === PERSONAL_VALUE ? null : e.target.value
                    setForm({
                      ...form,
                      teamId,
                      // 個人の予定はチームには出ないので、公開範囲もそろえる。
                      sharingState: teamId === null ? 'private' : form.sharingState,
                    })
                  }}
                >
                  <option value={PERSONAL_VALUE}>個人（自分のカレンダー）</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.teamName}
                    </option>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl>
              <FormLabel>
                公開範囲{' '}
                <Badge ml={1} colorScheme={sharing.colorScheme} variant="subtle">
                  {sharing.label}
                </Badge>
              </FormLabel>
              <Select
                value={form.sharingState}
                isDisabled={isPersonal}
                onChange={(e) => setForm({ ...form, sharingState: e.target.value })}
              >
                <option value="private">自分のみ</option>
                <option value="friends">友だち</option>
                <option value="team">チーム</option>
              </Select>
              {isPersonal && (
                <Text fontSize="xs" color="gray.500" mt={1}>
                  個人の予定は自分だけが見られます。
                </Text>
              )}
            </FormControl>

            <FormControl>
              <FormLabel>繰り返し</FormLabel>
              <Select
                value={form.recurrence}
                onChange={(e) => setForm({ ...form, recurrence: e.target.value as EventForm['recurrence'] })}
              >
                {(Object.keys(RECURRENCE_LABEL) as EventForm['recurrence'][]).map((r) => (
                  <option key={r} value={r}>
                    {RECURRENCE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </FormControl>

            {form.recurrence !== 'none' && (
              <FormControl>
                <FormLabel>繰り返しの終了日（任意）</FormLabel>
                <ChakraInput
                  type="date"
                  value={form.recurrenceEndDate}
                  min={form.startDate || undefined}
                  onChange={(e) => setForm({ ...form, recurrenceEndDate: e.target.value })}
                />
              </FormControl>
            )}

            <Text fontSize="xs" color="gray.500">
              タイムゾーン: {form.timezone ?? viewerTimeZone()}
              {form.timezone && form.timezone !== viewerTimeZone() && (
                <> （現在のタイムゾーン: {viewerTimeZone()}）</>
              )}
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="signal"
            onClick={onSubmit}
            isLoading={isSaving}
            loadingText={isEditing ? '保存中' : '作成中'}
            isDisabled={!form.name.trim() || !form.startDate || (!form.isAllDay && !form.startTime)}
          >
            {isEditing ? '保存する' : '作成する'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
