import { describe, it, expect } from 'vitest'
import { parseIcs, parseDuration, unescapeText, zonedTimeToUtc } from './icsImport'
import { toDateInput } from './calendarUtils'

// .ics は本来 CRLF 区切り。テストでも CRLF を使い、折り返し行の扱いも見る。
function ics(...lines: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...lines, 'END:VCALENDAR'].join('\r\n')
}

function vevent(...lines: string[]): string {
  return ics('BEGIN:VEVENT', ...lines, 'END:VEVENT')
}

describe('unescapeText', () => {
  it('restores escaped characters', () => {
    expect(unescapeText('Lunch\\, then\\; talk\\nsee you')).toBe('Lunch, then; talk\nsee you')
  })

  it('keeps a literal backslash', () => {
    expect(unescapeText('a\\\\b')).toBe('a\\b')
  })
})

describe('parseDuration', () => {
  it('parses hours and minutes', () => {
    expect(parseDuration('PT1H30M')).toBe(90 * 60 * 1000)
  })

  it('parses days and weeks', () => {
    expect(parseDuration('P1D')).toBe(24 * 60 * 60 * 1000)
    expect(parseDuration('P2W')).toBe(14 * 24 * 60 * 60 * 1000)
  })

  it('rejects junk and zero-length durations', () => {
    expect(parseDuration('1H')).toBeNull()
    expect(parseDuration('P')).toBeNull()
  })
})

describe('zonedTimeToUtc', () => {
  it('converts a wall-clock time in a named zone', () => {
    // 2026-08-14 09:00 Asia/Tokyo = 00:00 UTC
    expect(zonedTimeToUtc(2026, 8, 14, 9, 0, 0, 'Asia/Tokyo').toISOString()).toBe(
      '2026-08-14T00:00:00.000Z',
    )
  })

  it('honours daylight saving time', () => {
    // 夏時間中の New York は UTC-4
    expect(zonedTimeToUtc(2026, 7, 1, 12, 0, 0, 'America/New_York').toISOString()).toBe(
      '2026-07-01T16:00:00.000Z',
    )
    // 冬は UTC-5
    expect(zonedTimeToUtc(2026, 1, 15, 12, 0, 0, 'America/New_York').toISOString()).toBe(
      '2026-01-15T17:00:00.000Z',
    )
  })
})

describe('parseIcs', () => {
  it('parses a UTC timed event', () => {
    const result = parseIcs(
      vevent(
        'UID:abc-123',
        'SUMMARY:チームランチ',
        'LOCATION:渋谷',
        'DTSTART:20260814T030000Z',
        'DTEND:20260814T040000Z',
      ),
    )

    expect(result.skipped).toBe(0)
    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toMatchObject({
      uid: 'abc-123',
      name: 'チームランチ',
      eventLocation: '渋谷',
      startAt: '2026-08-14T03:00:00.000Z',
      endAt: '2026-08-14T04:00:00.000Z',
      isAllDay: false,
      recurrence: 'none',
    })
  })

  it('reads the calendar name from X-WR-CALNAME', () => {
    const result = parseIcs(
      ics('X-WR-CALNAME:私のカレンダー', 'BEGIN:VEVENT', 'DTSTART:20260814T030000Z', 'END:VEVENT'),
    )
    expect(result.calendarName).toBe('私のカレンダー')
  })

  it('converts TZID times to the right instant', () => {
    const result = parseIcs(
      vevent('DTSTART;TZID=Asia/Tokyo:20260814T090000', 'DTEND;TZID=Asia/Tokyo:20260814T100000'),
    )
    expect(result.events[0].startAt).toBe('2026-08-14T00:00:00.000Z')
    expect(result.events[0].timezone).toBe('Asia/Tokyo')
  })

  it('falls back to local time for an unknown TZID', () => {
    const result = parseIcs(
      vevent('DTSTART;TZID=Tokyo Standard Time:20260814T090000', 'DURATION:PT1H'),
      'Asia/Tokyo',
    )
    // 未知の TZID はローカル時刻として読む。ローカルの 9:00 になっていること。
    expect(new Date(result.events[0].startAt).getHours()).toBe(9)
    expect(result.events[0].timezone).toBe('Asia/Tokyo')
  })

  it('treats VALUE=DATE as an all-day event at local midnight', () => {
    const result = parseIcs(
      vevent('DTSTART;VALUE=DATE:20260814', 'DTEND;VALUE=DATE:20260816'),
      'Asia/Tokyo',
    )
    const ev = result.events[0]
    expect(ev.isAllDay).toBe(true)
    expect(ev.timezone).toBe('Asia/Tokyo')
    // 開始はローカル深夜、終了は排他的な 8/16 深夜（＝ 8/14, 8/15 の 2 日間）
    expect(new Date(ev.startAt).getDate()).toBe(14)
    expect(new Date(ev.startAt).getHours()).toBe(0)
    expect(new Date(ev.endAt).getDate()).toBe(16)
  })

  it('gives an all-day event without DTEND a single day', () => {
    const result = parseIcs(vevent('DTSTART;VALUE=DATE:20260814'))
    const ev = result.events[0]
    expect(ev.isAllDay).toBe(true)
    expect(new Date(ev.endAt).getTime() - new Date(ev.startAt).getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('uses DURATION when DTEND is missing', () => {
    const result = parseIcs(vevent('DTSTART:20260814T030000Z', 'DURATION:PT90M'))
    expect(result.events[0].endAt).toBe('2026-08-14T04:30:00.000Z')
  })

  it('defaults to one hour when neither DTEND nor DURATION is present', () => {
    const result = parseIcs(vevent('DTSTART:20260814T030000Z'))
    expect(result.events[0].endAt).toBe('2026-08-14T04:00:00.000Z')
  })

  it('unfolds wrapped lines', () => {
    const result = parseIcs(
      vevent('DTSTART:20260814T030000Z', 'SUMMARY:とても長いタイトルの', ' 予定です', 'DTEND:20260814T040000Z'),
    )
    expect(result.events[0].name).toBe('とても長いタイトルの予定です')
  })

  it('falls back to a placeholder title', () => {
    const result = parseIcs(vevent('DTSTART:20260814T030000Z'))
    expect(result.events[0].name).toBe('（無題の予定）')
  })

  it('skips VALARM blocks inside an event', () => {
    const result = parseIcs(
      vevent(
        'SUMMARY:本体',
        'DTSTART:20260814T030000Z',
        'BEGIN:VALARM',
        'TRIGGER:-PT10M',
        'SUMMARY:通知',
        'END:VALARM',
        'DTEND:20260814T040000Z',
      ),
    )
    expect(result.events[0].name).toBe('本体')
  })

  it('ignores VTIMEZONE definitions', () => {
    const result = parseIcs(
      ics(
        'BEGIN:VTIMEZONE',
        'TZID:Asia/Tokyo',
        'BEGIN:STANDARD',
        'DTSTART:19700101T000000',
        'TZOFFSETFROM:+0900',
        'TZOFFSETTO:+0900',
        'END:STANDARD',
        'END:VTIMEZONE',
        'BEGIN:VEVENT',
        'SUMMARY:会議',
        'DTSTART:20260814T030000Z',
        'END:VEVENT',
      ),
    )
    expect(result.events).toHaveLength(1)
    expect(result.events[0].name).toBe('会議')
  })

  it('parses several events and counts unusable ones', () => {
    const result = parseIcs(
      ics(
        'BEGIN:VEVENT',
        'SUMMARY:あり',
        'DTSTART:20260814T030000Z',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'SUMMARY:DTSTART なし',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'SUMMARY:中止',
        'STATUS:CANCELLED',
        'DTSTART:20260814T030000Z',
        'END:VEVENT',
      ),
    )
    expect(result.events).toHaveLength(1)
    expect(result.skipped).toBe(2)
  })

  it('rejects an event whose end is not after its start', () => {
    const result = parseIcs(vevent('DTSTART:20260814T040000Z', 'DTEND:20260814T030000Z'))
    expect(result.events).toHaveLength(0)
    expect(result.skipped).toBe(1)
  })

  describe('RRULE', () => {
    it('maps simple frequencies', () => {
      for (const [freq, expected] of [
        ['DAILY', 'daily'],
        ['WEEKLY', 'weekly'],
        ['MONTHLY', 'monthly'],
      ] as const) {
        const result = parseIcs(vevent('DTSTART:20260814T030000Z', `RRULE:FREQ=${freq}`))
        expect(result.events[0].recurrence).toBe(expected)
        expect(result.events[0].recurrenceDropped).toBe(false)
        expect(result.events[0].recurrenceEndDate).toBeNull()
      }
    })

    it('keeps a single BYDAY on a weekly rule', () => {
      const result = parseIcs(vevent('DTSTART:20260814T030000Z', 'RRULE:FREQ=WEEKLY;BYDAY=FR'))
      expect(result.events[0].recurrence).toBe('weekly')
    })

    it('turns UNTIL into a recurrence end date', () => {
      const result = parseIcs(
        vevent('DTSTART:20260814T030000Z', 'RRULE:FREQ=WEEKLY;UNTIL=20260911T030000Z'),
      )
      // 繰り返しの終了日はアプリ側もローカル日付で解釈するので、UTC の UNTIL は
      // 閲覧者のローカル暦日に落とす。
      expect(result.events[0].recurrenceEndDate).toBe(toDateInput(new Date('2026-09-11T03:00:00Z')))
    })

    it('turns COUNT into a recurrence end date', () => {
      // 8/14 から毎日 3 回 → 最終日は 8/16（ローカル時刻の DTSTART）
      const result = parseIcs(vevent('DTSTART:20260814T030000', 'RRULE:FREQ=DAILY;COUNT=3'))
      expect(result.events[0].recurrenceEndDate).toBe('2026-08-16')
    })

    it('drops rules it cannot represent', () => {
      const unsupported = [
        'FREQ=YEARLY',
        'FREQ=WEEKLY;INTERVAL=2',
        'FREQ=WEEKLY;BYDAY=MO,WE,FR',
        'FREQ=MONTHLY;BYDAY=2MO',
      ]
      for (const rule of unsupported) {
        const result = parseIcs(vevent('DTSTART:20260814T030000Z', `RRULE:${rule}`))
        expect(result.events[0].recurrence).toBe('none')
        expect(result.events[0].recurrenceDropped).toBe(true)
      }
    })
  })

  it('distinguishes a modified occurrence from its master by uid', () => {
    const result = parseIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:series-1',
        'DTSTART:20260814T030000Z',
        'RRULE:FREQ=WEEKLY',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:series-1',
        'RECURRENCE-ID:20260821T030000Z',
        'DTSTART:20260821T040000Z',
        'END:VEVENT',
      ),
    )
    expect(result.events.map((e) => e.uid)).toEqual(['series-1', 'series-1#20260821T030000Z'])
  })
})
