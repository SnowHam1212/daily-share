import type { Database } from '../../types/database'

export type EventRow = Database['public']['Tables']['events']['Row']
export type SharingState = EventRow['sharingState']
export type Recurrence = EventRow['recurrence']
export type CalendarView = 'day' | 'week' | 'month'

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  none: '繰り返さない',
  daily: '毎日',
  weekly: '毎週',
  monthly: '毎月',
}

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export const HOUR_HEIGHT = 48 // px per hour in the time grid
export const GUTTER = 56 // px — time-labels column
export const TOTAL_HEIGHT = HOUR_HEIGHT * 24

export const SHARING: Record<SharingState, { label: string; colorScheme: string }> = {
  private: { label: '自分のみ', colorScheme: 'gray' },
  friends: { label: '友だち', colorScheme: 'primary' },
  team: { label: 'チーム', colorScheme: 'signal' },
}

// Event block colors per sharing state, aligned with the design system.
export const EVENT_STYLE: Record<
  SharingState,
  { bg: string; accent: string; text: string; time: string; dot: string }
> = {
  private: { bg: 'gray.100', accent: 'gray.400', text: 'gray.700', time: 'gray.500', dot: 'gray.400' },
  friends: { bg: 'primary.50', accent: 'primary.500', text: 'primary.800', time: 'primary.600', dot: 'primary.500' },
  team: { bg: 'signal.50', accent: 'signal.500', text: 'signal.800', time: 'signal.600', dot: 'signal.500' },
}

// 15-minute time options: "00:00", "00:15", … "23:45".
export const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4)
  const m = (i % 4) * 15
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

export function startOfWeek(d: Date) {
  const dt = new Date(d)
  const day = dt.getDay()
  dt.setHours(0, 0, 0, 0)
  dt.setDate(dt.getDate() - day)
  return dt
}

export function startOfDay(d: Date) {
  const dt = new Date(d)
  dt.setHours(0, 0, 0, 0)
  return dt
}

export function addDays(d: Date, days: number) {
  const dt = new Date(d)
  dt.setDate(dt.getDate() + days)
  return dt
}

export function addMonths(d: Date, months: number) {
  const dt = new Date(d)
  dt.setMonth(dt.getMonth() + months)
  return dt
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export function minutesOfDay(d: Date) {
  return d.getHours() * 60 + d.getMinutes()
}

// Local "YYYY-MM-DD" for date inputs (avoids the UTC shift of toISOString).
export function toDateInput(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// minutes-from-midnight → "HH:MM"
export function minuteToTime(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

// 閲覧者のIANAタイムゾーン（例: "Asia/Tokyo"）。
export function viewerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

// instant を指定TZの暦日キー（YYYYMMDD の数値）に変換する。
export function dayKeyInTZ(instant: Date, tz: string): number {
  // en-CA は "YYYY-MM-DD" 形式で返る。
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
  return Number(s.replace(/-/g, ''))
}

// ローカル Date の暦日キー（YYYYMMDD）。グリッドのセル日付に使う。
function localDayKey(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

// instant を指定TZの "YYYY-MM-DD"（日付入力用）に変換。
export function dateInputInTZ(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

// その予定のTZが閲覧者と異なる場合、併記用の短いラベル（例: "Tokyo"）を返す。
export function eventTZLabel(ev: EventRow): string | null {
  if (!ev.timezone || ev.timezone === viewerTimeZone()) return null
  return ev.timezone.split('/').pop()?.replace(/_/g, ' ') ?? ev.timezone
}

// Does the event's range touch the given calendar day?
// 終日予定で timezone がある場合は、その予定のTZでの暦日で判定する
// （閲覧者のTZに関係なく、作成時に意図した日付に表示する）。
// timezone が無いレガシー行は従来どおり瞬時で判定。
export function overlapsDay(ev: EventRow, day: Date) {
  if (ev.isAllDay && ev.timezone) {
    const cell = localDayKey(day)
    const startKey = dayKeyInTZ(new Date(ev.startAt), ev.timezone)
    // endAt は排他的な翌日 0:00 を指すため、その暦日は含めない。
    const endKey = dayKeyInTZ(new Date(ev.endAt), ev.timezone)
    return startKey <= cell && cell < endKey
  }
  const ds = startOfDay(day)
  const de = addDays(ds, 1)
  return new Date(ev.startAt) < de && new Date(ev.endAt) > ds
}

// The 6-week (42-cell) grid that contains the month of `anchor`.
export function monthGridDays(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const gridStart = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}

export interface EventForm {
  name: string
  isAllDay: boolean
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  eventLocation: string
  sharingState: string
  recurrence: Recurrence
  recurrenceEndDate: string
  // 編集時に元予定のTZを引き継ぐ（新規作成時は undefined）。
  timezone?: string
  // 開始の何分前に通知するか。null = リマインダーなし。
  reminderMinutes: number | null
}

export const EMPTY_FORM: EventForm = {
  name: '',
  isAllDay: false,
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  eventLocation: '',
  sharingState: 'private',
  recurrence: 'none',
  recurrenceEndDate: '',
  timezone: undefined,
  reminderMinutes: null,
}

// リマインダーの選択肢（分）。null = なし。
export const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'なし' },
  { value: 0, label: '開始時刻' },
  { value: 5, label: '5分前' },
  { value: 10, label: '10分前' },
  { value: 15, label: '15分前' },
  { value: 30, label: '30分前' },
  { value: 60, label: '1時間前' },
  { value: 120, label: '2時間前' },
  { value: 1440, label: '1日前' },
]

export function reminderLabel(min: number | null): string {
  return REMINDER_OPTIONS.find((o) => o.value === min)?.label ?? `${min}分前`
}

// Local "HH:MM" (avoids the UTC shift of toISOString / getUTCHours).
function toTimeInput(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// EventRow → EventForm, ready to pre-fill the modal for editing.
// All-day events store an exclusive end (start-day + 1), so subtract a day to
// recover the inclusive end date the user originally picked.
export function eventToForm(ev: EventRow): EventForm {
  const start = new Date(ev.startAt)
  const end = new Date(ev.endAt)

  // 終日予定で timezone があれば、そのTZでの日付を出す（別TZの閲覧者でも
  // 作成時に意図した日付を編集できる）。レガシー行は従来どおりローカル。
  if (ev.isAllDay && ev.timezone) {
    const endExclusive = new Date(dateInputInTZ(end, ev.timezone))
    const endInclusive = addDays(endExclusive, -1)
    return {
      name: ev.name,
      isAllDay: true,
      startDate: dateInputInTZ(start, ev.timezone),
      startTime: '',
      endDate: toDateInput(endInclusive),
      endTime: '',
      eventLocation: ev.eventLocation ?? '',
      sharingState: ev.sharingState,
      recurrence: ev.recurrence ?? 'none',
      recurrenceEndDate: ev.recurrenceEndDate ?? '',
      timezone: ev.timezone,
      reminderMinutes: ev.reminderMinutes ?? null,
    }
  }

  const endInclusive = ev.isAllDay ? addDays(end, -1) : end
  return {
    name: ev.name,
    isAllDay: ev.isAllDay,
    startDate: toDateInput(start),
    startTime: ev.isAllDay ? '' : toTimeInput(start),
    endDate: toDateInput(endInclusive),
    endTime: ev.isAllDay ? '' : toTimeInput(end),
    eventLocation: ev.eventLocation ?? '',
    sharingState: ev.sharingState,
    recurrence: ev.recurrence ?? 'none',
    recurrenceEndDate: ev.recurrenceEndDate ?? '',
    timezone: ev.timezone ?? undefined,
    reminderMinutes: ev.reminderMinutes ?? null,
  }
}

// Expand a recurring "master" event into concrete occurrences that overlap the
// [rangeStart, rangeEnd) window. Each occurrence keeps the master's id (so
// clicking it edits the master) but carries shifted start/end times.
// Non-recurring events should be passed through directly, not via this helper.
export function expandRecurring(master: EventRow, rangeStart: Date, rangeEnd: Date): EventRow[] {
  if (!master.recurrence || master.recurrence === 'none') return []

  const start = new Date(master.startAt)
  const durationMs = new Date(master.endAt).getTime() - start.getTime()
  // Inclusive end-of-day of the recurrence end date (or no bound).
  const until = master.recurrenceEndDate
    ? addDays(startOfDay(new Date(`${master.recurrenceEndDate}T00:00`)), 1)
    : null

  const step = (d: Date): Date => {
    if (master.recurrence === 'daily') return addDays(d, 1)
    if (master.recurrence === 'weekly') return addDays(d, 7)
    return addMonths(d, 1) // monthly
  }

  const occurrences: EventRow[] = []
  let cursor = new Date(start)
  // Safety cap to avoid runaway loops on bad data.
  for (let i = 0; i < 400 && cursor < rangeEnd; i++) {
    if (until && cursor >= until) break
    const occEnd = new Date(cursor.getTime() + durationMs)
    if (occEnd > rangeStart) {
      occurrences.push({ ...master, startAt: cursor.toISOString(), endAt: occEnd.toISOString() })
    }
    cursor = step(cursor)
  }
  return occurrences
}

// Build the list of events to render for a range: non-recurring events as-is,
// plus expanded occurrences of recurring masters.
export function eventsForRange(events: EventRow[], rangeStart: Date, rangeEnd: Date): EventRow[] {
  const result: EventRow[] = []
  for (const ev of events) {
    if (!ev.recurrence || ev.recurrence === 'none') {
      result.push(ev)
    } else {
      result.push(...expandRecurring(ev, rangeStart, rangeEnd))
    }
  }
  return result
}

export type Positioned = {
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
export function layoutDay(day: Date, allEvents: EventRow[]): Positioned[] {
  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)

  const items = allEvents
    .map((ev) => {
      if (ev.isAllDay) return null // all-day events live in their own row
      const s = new Date(ev.startAt)
      const e = new Date(ev.endAt)
      if (!(s < dayEnd && e > dayStart)) return null
      const start = s <= dayStart ? 0 : minutesOfDay(s)
      const rawEnd = e >= dayEnd ? 24 * 60 : minutesOfDay(e)
      const end = Math.min(Math.max(rawEnd, start + 20), 24 * 60)
      return { ev, start, end, fromPrev: s < dayStart, toNext: e > dayEnd }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const result: Positioned[] = []
  let cluster: typeof items = []
  let clusterEnd = -1

  const flush = () => {
    const colEnds: number[] = []
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
