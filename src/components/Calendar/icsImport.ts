// iCalendar (.ics / RFC 5545) parser — 外部カレンダーの取り込み用。
//
// Google カレンダー・Apple カレンダー・Outlook いずれも .ics でエクスポート
// できるので、ファイルを読んで VEVENT を本アプリの events 行に落とし込む。
// 対応範囲はアプリのデータモデルに合わせて絞ってある：
//   - SUMMARY / LOCATION / DTSTART / DTEND / DURATION / UID / RRULE
//   - 終日（VALUE=DATE）、TZID 付き、UTC（末尾 Z）、フローティング時刻
//   - 繰り返しは INTERVAL=1 の DAILY / WEEKLY / MONTHLY のみ。表現できない
//     ルール（毎年・隔週・BYDAY 複数など）は単発として取り込み、
//     recurrenceDropped で呼び出し側に知らせる
import {
  addDays,
  addMonths,
  toDateInput,
  viewerTimeZone,
  type Recurrence,
} from './calendarUtils'

export interface ParsedIcsEvent {
  /** .ics の UID（再取り込み時の重複判定に使う）。無ければ null */
  uid: string | null
  name: string
  /** ISO 8601（UTC） */
  startAt: string
  endAt: string
  isAllDay: boolean
  eventLocation: string | null
  recurrence: Recurrence
  /** 'YYYY-MM-DD'。繰り返しの終わりが無ければ null */
  recurrenceEndDate: string | null
  timezone: string
  /** RRULE があったが本アプリで表現できず、単発として取り込む場合 true */
  recurrenceDropped: boolean
}

export interface IcsParseResult {
  /** X-WR-CALNAME（Google などが入れるカレンダー名） */
  calendarName: string | null
  events: ParsedIcsEvent[]
  /** DTSTART が無い・日時が壊れている等で取り込めなかった VEVENT の数 */
  skipped: number
}

interface IcsLine {
  name: string
  params: Record<string, string>
  value: string
}

interface IcsDate {
  date: Date
  /** VALUE=DATE（時刻を持たない＝終日） */
  isDateOnly: boolean
  timezone: string
}

const DATE_TIME_RE = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/
const DURATION_RE = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/

/** 折り返された行（次行が空白・タブ始まり）を 1 本に戻す。 */
function unfoldLines(text: string): string[] {
  const out: string[] = []
  for (const line of text.split(/\r\n|\n|\r/)) {
    if (out.length > 0 && (line.startsWith(' ') || line.startsWith('\t'))) {
      out[out.length - 1] += line.slice(1)
    } else {
      out.push(line)
    }
  }
  return out
}

/** 引用符の外側にある区切り文字だけで分割する。 */
function splitUnquoted(input: string, sep: string): string[] {
  const parts: string[] = []
  let current = ''
  let inQuotes = false
  for (const ch of input) {
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === sep && !inQuotes) {
      parts.push(current)
      current = ''
      continue
    }
    current += ch
  }
  parts.push(current)
  return parts
}

/** "DTSTART;TZID=Asia/Tokyo:20260814T090000" → name / params / value */
function parseLine(line: string): IcsLine | null {
  let inQuotes = false
  let colon = -1
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === ':' && !inQuotes) {
      colon = i
      break
    }
  }
  if (colon === -1) return null

  const segments = splitUnquoted(line.slice(0, colon), ';')
  const params: Record<string, string> = {}
  for (const segment of segments.slice(1)) {
    const eq = segment.indexOf('=')
    if (eq === -1) continue
    params[segment.slice(0, eq).toUpperCase()] = segment.slice(eq + 1).replace(/^"|"$/g, '')
  }
  return { name: segments[0].toUpperCase(), params, value: line.slice(colon + 1) }
}

/** TEXT 型のエスケープ（\n \, \; \\）を戻す。 */
export function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, ch: string) =>
    ch === 'n' || ch === 'N' ? '\n' : ch,
  )
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** instant を tz で見たときの壁掛け時計の値と UTC との差（ミリ秒）。 */
function timeZoneOffsetMs(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  // hour12:false でも実装により深夜が "24" になることがある。
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/**
 * 「そのタイムゾーンでの壁掛け時計の時刻」を実際の瞬間（UTC）に直す。
 * オフセットは瞬間に依存する（夏時間）ため、推定 → 補正の 2 段で解く。
 */
export function zonedTimeToUtc(
  y: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  tz: string,
): Date {
  const wall = Date.UTC(y, month - 1, day, hour, minute, second)
  let instant = wall - timeZoneOffsetMs(new Date(wall), tz)
  instant = wall - timeZoneOffsetMs(new Date(instant), tz)
  return new Date(instant)
}

/**
 * DTSTART / DTEND の値を解釈する。
 * - VALUE=DATE（時刻なし）→ ローカルの深夜。アプリの終日予定と同じ持ち方
 * - 末尾 Z → UTC
 * - TZID 付き → その TZ の壁掛け時計として解釈
 * - それ以外（フローティング）→ 閲覧者のローカル時刻
 */
function parseIcsDate(line: IcsLine, viewerTz: string): IcsDate | null {
  const match = DATE_TIME_RE.exec(line.value.trim())
  if (!match) return null

  const [, y, mo, d, h, mi, s, utc] = match
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)

  const dateOnly = line.params.VALUE?.toUpperCase() === 'DATE' || h === undefined
  if (dateOnly) {
    // 終日はローカル深夜で保存する（アプリの終日予定と同じ表現）。
    return { date: new Date(year, month - 1, day), isDateOnly: true, timezone: viewerTz }
  }

  const hour = Number(h)
  const minute = Number(mi)
  const second = Number(s)

  if (utc) {
    return {
      date: new Date(Date.UTC(year, month - 1, day, hour, minute, second)),
      isDateOnly: false,
      timezone: viewerTz,
    }
  }

  const tzid = line.params.TZID
  if (tzid && isValidTimeZone(tzid)) {
    return {
      date: zonedTimeToUtc(year, month, day, hour, minute, second, tzid),
      isDateOnly: false,
      timezone: tzid,
    }
  }

  // TZID が IANA 名でない（Outlook の "Tokyo Standard Time" など）場合も含め、
  // 解釈できないものは閲覧者のローカル時刻として扱う。
  return {
    date: new Date(year, month - 1, day, hour, minute, second),
    isDateOnly: false,
    timezone: viewerTz,
  }
}

/** "PT1H30M" → ミリ秒。解釈できなければ null。 */
export function parseDuration(value: string): number | null {
  const match = DURATION_RE.exec(value.trim())
  if (!match) return null
  const [, sign, w, d, h, mi, s] = match
  const ms =
    (Number(w ?? 0) * 7 * 24 * 60 * 60 + Number(d ?? 0) * 24 * 60 * 60 + Number(h ?? 0) * 60 * 60 + Number(mi ?? 0) * 60 + Number(s ?? 0)) *
    1000
  if (ms === 0) return null
  return sign === '-' ? -ms : ms
}

interface RecurrenceResult {
  recurrence: Recurrence
  recurrenceEndDate: string | null
  dropped: boolean
}

const DROPPED: RecurrenceResult = { recurrence: 'none', recurrenceEndDate: null, dropped: true }

/**
 * RRULE をアプリの recurrence（none/daily/weekly/monthly）に落とす。
 * 表現できないルールは単発（dropped）にする。取りこぼしを黙って捨てるより、
 * 呼び出し側で「繰り返しは取り込めません」と出すため。
 */
export function parseRRule(value: string, start: IcsDate): RecurrenceResult {
  const rule: Record<string, string> = {}
  for (const part of value.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    rule[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1)
  }

  const freq = rule.FREQ?.toUpperCase()
  const recurrence: Recurrence | null =
    freq === 'DAILY' ? 'daily' : freq === 'WEEKLY' ? 'weekly' : freq === 'MONTHLY' ? 'monthly' : null
  if (!recurrence) return DROPPED

  // 隔週・隔月などの間隔は持てない。
  if (rule.INTERVAL && Number(rule.INTERVAL) !== 1) return DROPPED
  // 「毎週 月・水・金」「第 2 月曜」などは開始日からの単純な繰り返しにならない。
  if (rule.BYDAY && (recurrence === 'monthly' || rule.BYDAY.includes(','))) return DROPPED
  if (rule.BYSETPOS || rule.BYMONTH || (rule.BYMONTHDAY && rule.BYMONTHDAY.includes(','))) return DROPPED

  if (rule.UNTIL) {
    const until = parseLine(`UNTIL:${rule.UNTIL}`)
    const parsed = until && parseIcsDate(until, start.timezone)
    if (!parsed) return { recurrence, recurrenceEndDate: null, dropped: false }
    return { recurrence, recurrenceEndDate: toDateInput(parsed.date), dropped: false }
  }

  if (rule.COUNT) {
    const count = Number(rule.COUNT)
    if (Number.isFinite(count) && count > 0) {
      // COUNT 回目の開始日＝繰り返しの最終日。
      let last = start.date
      for (let i = 1; i < Math.min(count, 400); i++) {
        last = recurrence === 'daily' ? addDays(last, 1) : recurrence === 'weekly' ? addDays(last, 7) : addMonths(last, 1)
      }
      return { recurrence, recurrenceEndDate: toDateInput(last), dropped: false }
    }
  }

  return { recurrence, recurrenceEndDate: null, dropped: false }
}

/** .ics のテキストを解析して、取り込める予定の一覧を返す。 */
export function parseIcs(text: string, viewerTz: string = viewerTimeZone()): IcsParseResult {
  const lines = unfoldLines(text)

  let calendarName: string | null = null
  const events: ParsedIcsEvent[] = []
  let skipped = 0

  // 現在読んでいる VEVENT のプロパティ。VEVENT の外では null。
  let current: Map<string, IcsLine> | null = null
  // VEVENT の中の入れ子ブロック（VALARM など）は丸ごと読み飛ばす。
  let nestedBlock: string | null = null

  for (const raw of lines) {
    const line = parseLine(raw)
    if (!line) continue

    if (line.name === 'BEGIN') {
      const block = line.value.toUpperCase()
      if (block === 'VEVENT') {
        current = new Map()
      } else if (current && !nestedBlock) {
        nestedBlock = block
      }
      continue
    }

    if (line.name === 'END') {
      const block = line.value.toUpperCase()
      if (nestedBlock && block === nestedBlock) {
        nestedBlock = null
      } else if (block === 'VEVENT' && current) {
        const parsed = toEvent(current, viewerTz)
        if (parsed) events.push(parsed)
        else skipped++
        current = null
      }
      continue
    }

    if (nestedBlock) continue

    if (current) {
      // 同名プロパティは最初の 1 つを採用する（EXDATE などは未対応）。
      if (!current.has(line.name)) current.set(line.name, line)
    } else if (line.name === 'X-WR-CALNAME') {
      calendarName = unescapeText(line.value).trim() || null
    }
  }

  return { calendarName, events, skipped }
}

function toEvent(props: Map<string, IcsLine>, viewerTz: string): ParsedIcsEvent | null {
  if (props.get('STATUS')?.value.toUpperCase() === 'CANCELLED') return null

  const dtStartLine = props.get('DTSTART')
  if (!dtStartLine) return null
  const start = parseIcsDate(dtStartLine, viewerTz)
  if (!start || isNaN(start.date.getTime())) return null

  const end = resolveEnd(props, start)
  if (!end || isNaN(end.getTime()) || end <= start.date) return null

  const rruleLine = props.get('RRULE')
  const rrule = rruleLine ? parseRRule(rruleLine.value, start) : null

  const summary = props.get('SUMMARY')?.value ?? ''
  const location = props.get('LOCATION')?.value ?? ''

  return {
    uid: buildUid(props),
    name: unescapeText(summary).trim() || '（無題の予定）',
    startAt: start.date.toISOString(),
    endAt: end.toISOString(),
    isAllDay: start.isDateOnly,
    eventLocation: unescapeText(location).trim() || null,
    recurrence: rrule?.recurrence ?? 'none',
    recurrenceEndDate: rrule?.recurrenceEndDate ?? null,
    timezone: start.timezone,
    recurrenceDropped: rrule?.dropped ?? false,
  }
}

/** DTEND、無ければ DURATION、それも無ければ既定の長さ（終日は 1 日、他は 1 時間）。 */
function resolveEnd(props: Map<string, IcsLine>, start: IcsDate): Date | null {
  const dtEndLine = props.get('DTEND')
  if (dtEndLine) {
    const end = parseIcsDate(dtEndLine, start.timezone)
    if (end) return end.date
  }

  const durationLine = props.get('DURATION')
  if (durationLine) {
    const ms = parseDuration(durationLine.value)
    if (ms !== null && ms > 0) return new Date(start.date.getTime() + ms)
  }

  return start.isDateOnly ? addDays(start.date, 1) : new Date(start.date.getTime() + 60 * 60 * 1000)
}

/**
 * 重複判定のキー。繰り返しの一部だけ変更された予定（RECURRENCE-ID 付き）は
 * マスターと UID が同じなので、別物として区別できるよう付け足す。
 */
function buildUid(props: Map<string, IcsLine>): string | null {
  const uid = props.get('UID')?.value.trim()
  if (!uid) return null
  const recurrenceId = props.get('RECURRENCE-ID')?.value.trim()
  return recurrenceId ? `${uid}#${recurrenceId}` : uid
}
