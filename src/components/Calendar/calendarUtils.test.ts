import { describe, it, expect } from 'vitest'
import {
  startOfDay,
  startOfWeek,
  addDays,
  addMonths,
  isSameDay,
  isSameMonth,
  toDateInput,
  minuteToTime,
  minutesOfDay,
  monthGridDays,
  overlapsDay,
  eventToForm,
  formToEventValues,
  layoutDay,
  viewerTimeZone,
  EMPTY_FORM,
  type EventForm,
  type EventRow,
} from './calendarUtils'

// Build an EventRow with sensible defaults; times are constructed in LOCAL time
// so the round-trip through eventToForm (which formats in local time) is stable.
function makeEvent(overrides: Partial<EventRow> & { startAt: string; endAt: string }): EventRow {
  return {
    id: overrides.id ?? 'e1',
    createdBy: overrides.createdBy ?? 'u1',
    teamId: overrides.teamId ?? 't1',
    name: overrides.name ?? 'Event',
    isAllDay: overrides.isAllDay ?? false,
    eventLocation: overrides.eventLocation ?? null,
    sharingState: overrides.sharingState ?? 'team',
    recurrence: overrides.recurrence ?? 'none',
    recurrenceEndDate: overrides.recurrenceEndDate ?? null,
    timezone: overrides.timezone ?? null,
    externalUid: overrides.externalUid ?? null,
    externalSource: overrides.externalSource ?? null,
    createdAt: overrides.createdAt ?? null,
    startAt: overrides.startAt,
    endAt: overrides.endAt,
  }
}

describe('date helpers', () => {
  it('startOfDay zeroes the time', () => {
    const d = startOfDay(new Date(2026, 5, 15, 13, 45, 30))
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(d.getDate()).toBe(15)
  })

  it('startOfWeek returns the preceding Sunday at midnight', () => {
    // 2026-06-17 is a Wednesday
    const ws = startOfWeek(new Date(2026, 5, 17, 10))
    expect(ws.getDay()).toBe(0) // Sunday
    expect(ws.getDate()).toBe(14)
    expect(ws.getHours()).toBe(0)
  })

  it('addDays handles month rollover', () => {
    const d = addDays(new Date(2026, 5, 30), 2) // Jun 30 + 2 = Jul 2
    expect(d.getMonth()).toBe(6)
    expect(d.getDate()).toBe(2)
  })

  it('addMonths handles year rollover', () => {
    const d = addMonths(new Date(2026, 11, 10), 1) // Dec -> Jan next year
    expect(d.getFullYear()).toBe(2027)
    expect(d.getMonth()).toBe(0)
  })

  it('isSameDay / isSameMonth', () => {
    expect(isSameDay(new Date(2026, 5, 1, 9), new Date(2026, 5, 1, 23))).toBe(true)
    expect(isSameDay(new Date(2026, 5, 1), new Date(2026, 5, 2))).toBe(false)
    expect(isSameMonth(new Date(2026, 5, 1), new Date(2026, 5, 30))).toBe(true)
    expect(isSameMonth(new Date(2026, 5, 30), new Date(2026, 6, 1))).toBe(false)
  })

  it('toDateInput formats local YYYY-MM-DD with padding', () => {
    expect(toDateInput(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('minuteToTime / minutesOfDay', () => {
    expect(minuteToTime(0)).toBe('00:00')
    expect(minuteToTime(9 * 60 + 5)).toBe('09:05')
    expect(minuteToTime(23 * 60 + 45)).toBe('23:45')
    expect(minutesOfDay(new Date(2026, 5, 1, 9, 30))).toBe(570)
  })
})

describe('monthGridDays', () => {
  it('returns a 42-cell grid starting on Sunday and covering the month', () => {
    const grid = monthGridDays(new Date(2026, 5, 15)) // June 2026
    expect(grid).toHaveLength(42)
    expect(grid[0].getDay()).toBe(0) // starts Sunday
    expect(grid.some((d) => d.getMonth() === 5 && d.getDate() === 1)).toBe(true)
    expect(grid.some((d) => d.getMonth() === 5 && d.getDate() === 30)).toBe(true)
  })
})

describe('overlapsDay', () => {
  const day = new Date(2026, 5, 10)
  it('true when the event covers the day', () => {
    const ev = makeEvent({
      startAt: new Date(2026, 5, 10, 9).toISOString(),
      endAt: new Date(2026, 5, 10, 10).toISOString(),
    })
    expect(overlapsDay(ev, day)).toBe(true)
  })
  it('false when the event is on another day', () => {
    const ev = makeEvent({
      startAt: new Date(2026, 5, 11, 9).toISOString(),
      endAt: new Date(2026, 5, 11, 10).toISOString(),
    })
    expect(overlapsDay(ev, day)).toBe(false)
  })
  it('true for a multi-day event spanning the day', () => {
    const ev = makeEvent({
      startAt: new Date(2026, 5, 9, 20).toISOString(),
      endAt: new Date(2026, 5, 11, 8).toISOString(),
    })
    expect(overlapsDay(ev, day)).toBe(true)
  })
})

describe('eventToForm', () => {
  it('maps a timed event to form fields', () => {
    const ev = makeEvent({
      name: 'Lunch',
      eventLocation: 'Cafe',
      sharingState: 'friends',
      startAt: new Date(2026, 5, 1, 12, 0).toISOString(),
      endAt: new Date(2026, 5, 1, 13, 30).toISOString(),
    })
    const form = eventToForm(ev)
    expect(form).toMatchObject({
      name: 'Lunch',
      isAllDay: false,
      startDate: '2026-06-01',
      startTime: '12:00',
      endDate: '2026-06-01',
      endTime: '13:30',
      eventLocation: 'Cafe',
      sharingState: 'friends',
    })
  })

  it('recovers the inclusive end date for all-day events (stored end is exclusive)', () => {
    // All-day Jun 1: stored end = Jun 2 00:00 (exclusive). Form should show Jun 1.
    const ev = makeEvent({
      isAllDay: true,
      startAt: new Date(2026, 5, 1, 0, 0).toISOString(),
      endAt: new Date(2026, 5, 2, 0, 0).toISOString(),
    })
    const form = eventToForm(ev)
    expect(form.isAllDay).toBe(true)
    expect(form.startDate).toBe('2026-06-01')
    expect(form.endDate).toBe('2026-06-01')
    expect(form.startTime).toBe('')
    expect(form.endTime).toBe('')
  })
})

describe('layoutDay', () => {
  const day = new Date(2026, 5, 10)

  it('places two non-overlapping events in a single column', () => {
    const events = [
      makeEvent({ id: 'a', startAt: new Date(2026, 5, 10, 9).toISOString(), endAt: new Date(2026, 5, 10, 10).toISOString() }),
      makeEvent({ id: 'b', startAt: new Date(2026, 5, 10, 11).toISOString(), endAt: new Date(2026, 5, 10, 12).toISOString() }),
    ]
    const positioned = layoutDay(day, events)
    expect(positioned).toHaveLength(2)
    expect(positioned.every((p) => p.colCount === 1)).toBe(true)
  })

  it('splits overlapping events into side-by-side columns', () => {
    const events = [
      makeEvent({ id: 'a', startAt: new Date(2026, 5, 10, 9).toISOString(), endAt: new Date(2026, 5, 10, 11).toISOString() }),
      makeEvent({ id: 'b', startAt: new Date(2026, 5, 10, 10).toISOString(), endAt: new Date(2026, 5, 10, 12).toISOString() }),
    ]
    const positioned = layoutDay(day, events)
    expect(positioned).toHaveLength(2)
    expect(Math.max(...positioned.map((p) => p.colCount))).toBe(2)
    expect(new Set(positioned.map((p) => p.colIndex)).size).toBe(2)
  })

  it('excludes all-day events', () => {
    const events = [
      makeEvent({ id: 'allday', isAllDay: true, startAt: new Date(2026, 5, 10, 0).toISOString(), endAt: new Date(2026, 5, 11, 0).toISOString() }),
    ]
    expect(layoutDay(day, events)).toHaveLength(0)
  })
})

describe('formToEventValues', () => {
  const base: EventForm = {
    ...EMPTY_FORM,
    name: '打ち合わせ',
    startDate: '2026-06-10',
    startTime: '09:00',
    endDate: '2026-06-10',
    endTime: '10:00',
  }

  function values(form: EventForm) {
    const result = formToEventValues(form)
    if (!result.ok) throw new Error(`expected ok, got: ${result.error}`)
    return result.values
  }

  it('converts a timed event to local instants', () => {
    const v = values(base)
    expect(v.startAt).toBe(new Date(2026, 5, 10, 9).toISOString())
    expect(v.endAt).toBe(new Date(2026, 5, 10, 10).toISOString())
    expect(v.isAllDay).toBe(false)
    expect(v.timezone).toBe(viewerTimeZone())
  })

  it('keeps a personal event teamId of null', () => {
    expect(values(base).teamId).toBeNull()
    expect(values({ ...base, teamId: 't1' }).teamId).toBe('t1')
  })

  it('stores an all-day event as midnight..next midnight (exclusive)', () => {
    const v = values({ ...base, isAllDay: true, endDate: '2026-06-11' })
    expect(v.startAt).toBe(new Date(2026, 5, 10).toISOString())
    expect(v.endAt).toBe(new Date(2026, 5, 12).toISOString())
  })

  it('defaults an all-day event without an end date to a single day', () => {
    const v = values({ ...base, isAllDay: true, endDate: '' })
    expect(v.endAt).toBe(new Date(2026, 5, 11).toISOString())
  })

  it('defaults a missing end time to one hour', () => {
    const v = values({ ...base, endTime: '' })
    expect(v.endAt).toBe(new Date(2026, 5, 10, 10).toISOString())
  })

  it('keeps the original timezone when editing', () => {
    expect(values({ ...base, timezone: 'America/New_York' }).timezone).toBe('America/New_York')
  })

  it('drops the recurrence end date when the event does not repeat', () => {
    const v = values({ ...base, recurrence: 'none', recurrenceEndDate: '2026-07-01' })
    expect(v.recurrenceEndDate).toBeNull()
  })

  it('keeps the recurrence end date for a repeating event', () => {
    const v = values({ ...base, recurrence: 'weekly', recurrenceEndDate: '2026-07-01' })
    expect(v.recurrenceEndDate).toBe('2026-07-01')
  })

  it('trims the title and turns a blank location into null', () => {
    const v = values({ ...base, name: '  打ち合わせ  ', eventLocation: '   ' })
    expect(v.name).toBe('打ち合わせ')
    expect(v.eventLocation).toBeNull()
  })

  it('rejects an empty title', () => {
    expect(formToEventValues({ ...base, name: '   ' })).toEqual({
      ok: false,
      error: 'タイトルを入力してください',
    })
  })

  it('rejects a missing start date or time', () => {
    expect(formToEventValues({ ...base, startDate: '' }).ok).toBe(false)
    expect(formToEventValues({ ...base, startTime: '' }).ok).toBe(false)
    // 終日なら開始時刻は要らない
    expect(formToEventValues({ ...base, isAllDay: true, startTime: '' }).ok).toBe(true)
  })

  // DB の CHECK ("startAt" < "endAt") に当てて分かりにくいエラーを出さないよう、
  // フォーム側で先に弾く。
  it('rejects an end that is not after the start', () => {
    const result = formToEventValues({ ...base, endTime: '09:00' })
    expect(result).toEqual({ ok: false, error: '終了は開始より後にしてください' })
  })

  it('rejects an all-day end date before the start date', () => {
    const result = formToEventValues({ ...base, isAllDay: true, endDate: '2026-06-09' })
    expect(result).toEqual({ ok: false, error: '終了日は開始日以降にしてください' })
  })
})
