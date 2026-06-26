// 日本の祝日（国民の祝日）を算出するユーティリティ。
// 外部依存なし。現行の祝日法（2007年以降）に対応し、振替休日・国民の休日・
// 春分/秋分の日（2000〜2099年の近似式）を含む。
// 注: 2020/2021 の東京五輪に伴う特例移動には対応していない（通常年のルール）。

import { toDateInput } from './calendarUtils'

function nthMonday(year: number, month: number, n: number): number {
  // month: 0-indexed。その月の第 n 月曜日の「日」を返す。
  const first = new Date(year, month, 1).getDay() // 0=日
  const firstMonday = ((8 - first) % 7) + 1
  return firstMonday + (n - 1) * 7
}

// 春分の日（3月）/ 秋分の日（9月）の近似式（1980年基準, 2000-2099 有効）。
function vernalEquinoxDay(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}
function autumnalEquinoxDay(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

// その年の「固定的な」祝日（振替・国民の休日を適用する前）を算出。
function fixedHolidays(year: number): Map<string, string> {
  const m = new Map<string, string>()
  const add = (month: number, day: number, name: string) => {
    m.set(toDateInput(new Date(year, month - 1, day)), name)
  }

  add(1, 1, '元日')
  add(1, nthMonday(year, 0, 2), '成人の日')
  add(2, 11, '建国記念の日')
  if (year >= 2020) add(2, 23, '天皇誕生日')
  add(3, vernalEquinoxDay(year), '春分の日')
  add(4, 29, '昭和の日')
  add(5, 3, '憲法記念日')
  add(5, 4, 'みどりの日')
  add(5, 5, 'こどもの日')
  add(7, nthMonday(year, 6, 3), '海の日')
  if (year >= 2016) add(8, 11, '山の日')
  add(9, nthMonday(year, 8, 3), '敬老の日')
  add(9, autumnalEquinoxDay(year), '秋分の日')
  add(10, nthMonday(year, 9, 2), year >= 2020 ? 'スポーツの日' : '体育の日')
  add(11, 3, '文化の日')
  add(11, 23, '勤労感謝の日')

  return m
}

const cache = new Map<number, Map<string, string>>()

function holidaysForYear(year: number): Map<string, string> {
  const cached = cache.get(year)
  if (cached) return cached

  const base = fixedHolidays(year)
  const result = new Map(base)

  // 国民の休日: ある祝日の「翌日」が祝日でなく、その「翌々日」が祝日で、
  // 挟まれた日が日曜でなければ休日になる。
  // 例: 9月の敬老の日と秋分の日に挟まれた平日。
  for (const key of base.keys()) {
    const d = new Date(key)
    const between = new Date(d)
    between.setDate(d.getDate() + 1)
    const after = new Date(d)
    after.setDate(d.getDate() + 2)
    const betweenKey = toDateInput(between)
    if (base.has(toDateInput(after)) && !base.has(betweenKey) && between.getDay() !== 0) {
      result.set(betweenKey, '国民の休日')
    }
  }

  // 振替休日: 祝日が日曜なら、その後の最初の「祝日でない日」を休日にする。
  for (const key of base.keys()) {
    const d = new Date(key)
    if (d.getDay() === 0) {
      const sub = new Date(d)
      do {
        sub.setDate(sub.getDate() + 1)
      } while (result.has(toDateInput(sub)))
      result.set(toDateInput(sub), '振替休日')
    }
  }

  cache.set(year, result)
  return result
}

/** 指定日が祝日ならその名称、そうでなければ null を返す。 */
export function getHolidayName(date: Date): string | null {
  return holidaysForYear(date.getFullYear()).get(toDateInput(date)) ?? null
}
