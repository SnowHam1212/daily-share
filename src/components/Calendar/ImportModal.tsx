import { useRef, useState } from 'react'
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
  Checkbox,
  Box,
  HStack,
  VStack,
  Text,
  Badge,
  Alert,
  AlertIcon,
  Center,
  Spinner,
  Link,
  useToast,
} from '@chakra-ui/react'
import { Button } from '../ui/Button'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { parseIcs, type ParsedIcsEvent } from './icsImport'
import { RECURRENCE_LABEL, WEEKDAYS, type SharingState } from './calendarUtils'

type ImportTeam = { id: string; teamName: string }

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  teams: ImportTeam[]
  /** 取り込み後にカレンダーを再読み込みさせる */
  onImported: () => void
}

// 一度に取り込める件数の上限。数年分の書き出しをそのまま投げ込まれても
// プレビューと INSERT が破綻しないようにする。
const MAX_IMPORT = 500
// INSERT はまとめて送る（PostgREST のリクエストが大きくなりすぎない粒度）。
const CHUNK_SIZE = 100
const PERSONAL_VALUE = ''

interface Candidate extends ParsedIcsEvent {
  /** 一覧内で一意なキー（UID が無い .ics もあるので通し番号で振る） */
  key: string
  /** 同じ UID の予定が既にある */
  duplicate: boolean
}

export function ImportModal({ isOpen, onClose, teams, onImported }: ImportModalProps) {
  const { user } = useAuth()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)

  const [sourceName, setSourceName] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [truncated, setTruncated] = useState(0)
  const [skipped, setSkipped] = useState(0)
  // 既定は「個人」。取り込むのは自分の外部カレンダーなので、
  // 明示的に選ばない限りチームには流さない。
  const [teamId, setTeamId] = useState<string | null>(null)
  const [sharingState, setSharingState] = useState<SharingState>('private')
  const [reading, setReading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  function reset() {
    setSourceName(null)
    setCandidates(null)
    setSelected(new Set())
    setTruncated(0)
    setSkipped(0)
    setError(null)
    setDragging(false)
  }

  function handleClose() {
    if (importing) return
    reset()
    onClose()
  }

  async function handleFile(file: File) {
    reset()
    setReading(true)
    try {
      const text = await file.text()
      const result = parseIcs(text)

      if (result.events.length === 0) {
        setError(
          result.skipped > 0
            ? 'このファイルの予定は取り込める形式ではありませんでした。'
            : 'このファイルに予定が見つかりませんでした。.ics ファイルを選んでください。',
        )
        return
      }

      // 多すぎる場合は「今」に近い予定を優先して残す。
      let events = result.events
      let cut = 0
      if (events.length > MAX_IMPORT) {
        const now = Date.now()
        cut = events.length - MAX_IMPORT
        events = [...events]
          .sort(
            (a, b) =>
              Math.abs(new Date(a.startAt).getTime() - now) - Math.abs(new Date(b.startAt).getTime() - now),
          )
          .slice(0, MAX_IMPORT)
      }
      events = [...events].sort((a, b) => a.startAt.localeCompare(b.startAt))

      const duplicates = await findAlreadyImported(events)
      const list: Candidate[] = events.map((ev, i) => ({
        ...ev,
        key: String(i),
        duplicate: ev.uid !== null && duplicates.has(ev.uid),
      }))

      setSourceName(result.calendarName || file.name)
      setCandidates(list)
      setTruncated(cut)
      setSkipped(result.skipped)
      // 取り込み済みのものは既定で外しておく。
      setSelected(new Set(list.filter((c) => !c.duplicate).map((c) => c.key)))
    } catch (e) {
      console.error('ics parse error', e)
      setError('ファイルを読み込めませんでした。')
    } finally {
      setReading(false)
    }
  }

  /** 既に同じ UID で取り込んだ予定を引く（重複取り込みを避けるため）。 */
  async function findAlreadyImported(events: ParsedIcsEvent[]): Promise<Set<string>> {
    const uids = events.map((e) => e.uid).filter((u): u is string => !!u)
    if (!user || uids.length === 0) return new Set()

    const found = new Set<string>()
    for (let i = 0; i < uids.length; i += CHUNK_SIZE) {
      const { data, error: queryError } = await supabase
        .from('events')
        .select('externalUid')
        .eq('createdBy', user.id)
        .in('externalUid', uids.slice(i, i + CHUNK_SIZE))
      if (queryError) {
        // 重複判定に失敗しても取り込み自体は続けられる（全部「新規」扱い）。
        console.error('duplicate lookup error', queryError)
        return found
      }
      for (const row of data ?? []) {
        if (row.externalUid) found.add(row.externalUid)
      }
    }
    return found
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAll() {
    if (!candidates) return
    setSelected((prev) =>
      prev.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.key)),
    )
  }

  async function handleImport() {
    if (!user || !candidates) return
    const targets = candidates.filter((c) => selected.has(c.key))
    if (targets.length === 0) return

    setImporting(true)
    try {
      const rows = targets.map((ev) => ({
        createdBy: user.id,
        teamId,
        name: ev.name,
        startAt: ev.startAt,
        endAt: ev.endAt,
        isAllDay: ev.isAllDay,
        eventLocation: ev.eventLocation,
        sharingState,
        recurrence: ev.recurrence,
        recurrenceEndDate: ev.recurrenceEndDate,
        timezone: ev.timezone,
        externalUid: ev.uid,
        externalSource: sourceName,
      }))

      let inserted = 0
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const { error: insertError } = await supabase.from('events').insert(rows.slice(i, i + CHUNK_SIZE))
        if (insertError) {
          console.error('import insert error', insertError)
          toast({
            status: 'error',
            title: '取り込みに失敗しました',
            description: `${inserted} 件を取り込んだところで止まりました: ${insertError.message}`,
            duration: 9000,
            isClosable: true,
          })
          if (inserted > 0) onImported()
          return
        }
        inserted += Math.min(CHUNK_SIZE, rows.length - i)
      }

      toast({ status: 'success', title: `${inserted} 件の予定を取り込みました` })
      onImported()
      reset()
      onClose()
    } finally {
      setImporting(false)
    }
  }

  const droppedRecurrence = candidates?.filter((c) => c.recurrenceDropped).length ?? 0

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered size="lg" scrollBehavior="inside">
      <ModalOverlay bg="blackAlpha.500" backdropFilter="blur(2px)" />
      <ModalContent mx={4}>
        <ModalHeader fontFamily="heading">外部カレンダーから取り込む</ModalHeader>
        <ModalCloseButton borderRadius="full" />

        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* ファイル選択（クリック or ドラッグ＆ドロップ） */}
            <Box
              as="button"
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e: React.DragEvent) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e: React.DragEvent) => {
                e.preventDefault()
                setDragging(false)
                const file = e.dataTransfer.files?.[0]
                if (file) void handleFile(file)
              }}
              w="full"
              py={6}
              px={4}
              borderRadius="xl"
              border="2px dashed"
              borderColor={dragging ? 'signal.400' : 'gray.200'}
              bg={dragging ? 'signal.50' : 'paper-2'}
              transition="all 0.15s"
              _hover={{ borderColor: 'signal.300', bg: 'signal.50' }}
            >
              <Text fontSize="sm" fontWeight="600" color="gray.700">
                .ics ファイルを選ぶ / ここにドロップ
              </Text>
              <Text fontSize="xs" color="gray.500" mt={1}>
                Google カレンダー・Apple カレンダー・Outlook から書き出したファイル
              </Text>
            </Box>
            <input
              ref={fileInput}
              type="file"
              accept=".ics,.ical,text/calendar"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
                // 同じファイルを選び直せるようにする。
                e.target.value = ''
              }}
            />

            <Text fontSize="xs" color="gray.500">
              Google カレンダーなら「設定 → インポート/エクスポート → エクスポート」で .ics
              を書き出せます。
              <Link
                href="https://support.google.com/calendar/answer/37111"
                isExternal
                color="primary.600"
                ml={1}
              >
                書き出し方法
              </Link>
            </Text>

            {reading && (
              <Center py={6}>
                <Spinner color="primary.500" thickness="3px" />
              </Center>
            )}

            {error && (
              <Alert status="error" borderRadius="lg" fontSize="sm">
                <AlertIcon />
                {error}
              </Alert>
            )}

            {candidates && (
              <>
                {truncated > 0 && (
                  <Alert status="warning" borderRadius="lg" fontSize="sm">
                    <AlertIcon />
                    予定が多いため、今日に近い {MAX_IMPORT} 件のみ表示しています（残り {truncated} 件）。
                  </Alert>
                )}
                {skipped > 0 && (
                  <Text fontSize="xs" color="gray.500">
                    日時を読み取れない・中止済みの予定 {skipped} 件は除いています。
                  </Text>
                )}
                {droppedRecurrence > 0 && (
                  <Text fontSize="xs" color="gray.500">
                    このアプリで表現できない繰り返し（隔週・毎年など）の {droppedRecurrence} 件は、
                    単発の予定として取り込みます。
                  </Text>
                )}

                {teams.length > 0 && (
                  <FormControl>
                    <FormLabel>保存先</FormLabel>
                    <Select
                      value={teamId ?? PERSONAL_VALUE}
                      onChange={(e) => {
                        const next = e.target.value === PERSONAL_VALUE ? null : e.target.value
                        setTeamId(next)
                        if (next === null) setSharingState('private')
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
                  <FormLabel>公開範囲</FormLabel>
                  <Select
                    value={sharingState}
                    isDisabled={teamId === null}
                    onChange={(e) => setSharingState(e.target.value as SharingState)}
                  >
                    <option value="private">自分のみ</option>
                    <option value="friends">友だち</option>
                    <option value="team">チーム</option>
                  </Select>
                  {teamId === null && (
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      個人の予定は自分だけが見られます。
                    </Text>
                  )}
                </FormControl>

                <Box>
                  <HStack justify="space-between" mb={2}>
                    <Text fontSize="xs" fontWeight="bold" color="gray.500" letterSpacing="wide">
                      取り込む予定（{selected.size}/{candidates.length}）
                    </Text>
                    <Button size="sm" variant="ghost" onClick={toggleAll}>
                      {selected.size === candidates.length ? 'すべて外す' : 'すべて選ぶ'}
                    </Button>
                  </HStack>

                  <VStack
                    align="stretch"
                    spacing={0}
                    maxH="260px"
                    overflowY="auto"
                    border="1px solid"
                    borderColor="gray.200"
                    borderRadius="lg"
                  >
                    {candidates.map((c) => (
                      <HStack
                        key={c.key}
                        align="start"
                        spacing={3}
                        px={3}
                        py={2}
                        borderBottom="1px solid"
                        borderColor="gray.100"
                        _last={{ borderBottom: 'none' }}
                      >
                        <Checkbox
                          mt={1}
                          colorScheme="primary"
                          isChecked={selected.has(c.key)}
                          onChange={() => toggle(c.key)}
                        />
                        <Box minW={0} flex={1}>
                          <HStack spacing={2}>
                            <Text fontSize="sm" fontWeight="600" color="gray.800" noOfLines={1}>
                              {c.name}
                            </Text>
                            {c.duplicate && (
                              <Badge colorScheme="gray" variant="subtle" flexShrink={0}>
                                取込済み
                              </Badge>
                            )}
                            {c.recurrence !== 'none' && (
                              <Badge colorScheme="primary" variant="subtle" flexShrink={0}>
                                {RECURRENCE_LABEL[c.recurrence]}
                              </Badge>
                            )}
                          </HStack>
                          <Text fontSize="xs" color="gray.500" noOfLines={1}>
                            {describeRange(c)}
                            {c.eventLocation ? ` ・ ${c.eventLocation}` : ''}
                          </Text>
                        </Box>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
              </>
            )}
          </VStack>
        </ModalBody>

        <ModalFooter gap={2}>
          <Button variant="ghost" onClick={handleClose} isDisabled={importing}>
            キャンセル
          </Button>
          <Button
            variant="signal"
            onClick={handleImport}
            isLoading={importing}
            loadingText="取り込み中"
            isDisabled={!candidates || selected.size === 0}
          >
            {selected.size > 0 ? `${selected.size} 件を取り込む` : '取り込む'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

/** プレビュー用の日時表示。「8/14(金) 09:00–10:00」「8/14(金) 終日」 */
function describeRange(ev: ParsedIcsEvent): string {
  const start = new Date(ev.startAt)
  const end = new Date(ev.endAt)
  const day = `${start.getMonth() + 1}/${start.getDate()}(${WEEKDAYS[start.getDay()]})`
  if (ev.isAllDay) {
    const lastDay = new Date(end.getTime() - 24 * 60 * 60 * 1000)
    const span =
      lastDay.getTime() > start.getTime() ? `〜${lastDay.getMonth() + 1}/${lastDay.getDate()}` : ''
    return `${day}${span} 終日`
  }
  const hm = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${day} ${hm(start)}–${hm(end)}`
}
