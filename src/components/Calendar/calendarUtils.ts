import type { Database } from '../../types/database'

export type EventRow = Database['public']['Tables']['events']['Row']
export type SharingState = EventRow['sharingState']
export type CalendarView = 'day' | 'week' | 'month'

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

// Does the event's [start, end) range touch the given calendar day?
export function overlapsDay(ev: EventRow, day: Date) {
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
