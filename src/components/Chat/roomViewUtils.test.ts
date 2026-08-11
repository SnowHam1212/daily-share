import { describe, it, expect } from 'vitest'
import {
  isSameDay,
  formatDateLabel,
  formatTime,
  computeMessageFlags,
  type MessageLike,
} from './roomViewUtils'

// 日時はローカル時刻で組み立てる。isSameDay / formatDateLabel は閲覧者の
// ローカルタイムゾーンで判定するため、こうしておくと実行環境の TZ に
// 依らずアサーションが安定する（calendarUtils.test.ts と同じ方針）。
function at(y: number, m: number, d: number, h = 12, min = 0) {
  return new Date(y, m - 1, d, h, min).toISOString()
}

function msg(userId: string, createdAt: string | null): MessageLike {
  return { userId, createdAt }
}

describe('isSameDay', () => {
  it('同じ日なら true', () => {
    expect(isSameDay(at(2026, 8, 11, 0, 0), at(2026, 8, 11, 23, 59))).toBe(true)
  })

  it('日を跨ぐと false（1分差でも）', () => {
    expect(isSameDay(at(2026, 8, 11, 23, 59), at(2026, 8, 12, 0, 0))).toBe(false)
  })

  it('月をまたぐ同じ日付は false', () => {
    expect(isSameDay(at(2026, 8, 11), at(2026, 9, 11))).toBe(false)
  })

  it('年をまたぐ同じ月日は false', () => {
    expect(isSameDay(at(2025, 8, 11), at(2026, 8, 11))).toBe(false)
  })

  it('null が絡む場合は false', () => {
    expect(isSameDay(null, at(2026, 8, 11))).toBe(false)
    expect(isSameDay(at(2026, 8, 11), null)).toBe(false)
    expect(isSameDay(null, null)).toBe(false)
  })
})

describe('formatDateLabel', () => {
  it('月日と曜日を出す', () => {
    // 2026-08-11 は火曜日
    expect(formatDateLabel(at(2026, 8, 11))).toBe('8月11日(火)')
  })

  it('1桁の月日をゼロ埋めしない', () => {
    // 2026-01-05 は月曜日
    expect(formatDateLabel(at(2026, 1, 5))).toBe('1月5日(月)')
  })

  it('null は空文字', () => {
    expect(formatDateLabel(null)).toBe('')
  })
})

describe('formatTime', () => {
  it('24時間表記でゼロ埋めする', () => {
    expect(formatTime(at(2026, 8, 11, 9, 5))).toBe('09:05')
  })

  it('午後を 24 時間表記で出す', () => {
    expect(formatTime(at(2026, 8, 11, 21, 30))).toBe('21:30')
  })

  it('null は空文字', () => {
    expect(formatTime(null)).toBe('')
  })
})

describe('computeMessageFlags', () => {
  it('空配列なら空配列', () => {
    expect(computeMessageFlags([])).toEqual([])
  })

  it('先頭は必ず日付セパレータとグループ先頭になる', () => {
    const flags = computeMessageFlags([msg('u1', at(2026, 8, 11, 10, 0))])
    expect(flags).toEqual([{ showDate: true, startGroup: true }])
  })

  it('同じ人の連投はグループ先頭にしない', () => {
    const flags = computeMessageFlags([
      msg('u1', at(2026, 8, 11, 10, 0)),
      msg('u1', at(2026, 8, 11, 10, 1)),
      msg('u1', at(2026, 8, 11, 10, 2)),
    ])
    expect(flags.map((f) => f.startGroup)).toEqual([true, false, false])
    expect(flags.map((f) => f.showDate)).toEqual([true, false, false])
  })

  it('話者が変わったらグループ先頭になる', () => {
    const flags = computeMessageFlags([
      msg('u1', at(2026, 8, 11, 10, 0)),
      msg('u2', at(2026, 8, 11, 10, 1)),
      msg('u1', at(2026, 8, 11, 10, 2)),
    ])
    expect(flags.map((f) => f.startGroup)).toEqual([true, true, true])
    expect(flags.map((f) => f.showDate)).toEqual([true, false, false])
  })

  it('日が変わったらセパレータを出す', () => {
    const flags = computeMessageFlags([
      msg('u1', at(2026, 8, 11, 23, 59)),
      msg('u2', at(2026, 8, 12, 0, 1)),
    ])
    expect(flags.map((f) => f.showDate)).toEqual([true, true])
  })

  it('日跨ぎで同じ人が続く場合もセパレータ直後はグループ先頭にする', () => {
    // アバターと名前が出ないまま日付が変わると、誰の発言か分からなくなる
    const flags = computeMessageFlags([
      msg('u1', at(2026, 8, 11, 23, 59)),
      msg('u1', at(2026, 8, 12, 0, 1)),
    ])
    expect(flags[1]).toEqual({ showDate: true, startGroup: true })
  })

  it('createdAt が null のメッセージでもセパレータ判定で落ちない', () => {
    const flags = computeMessageFlags([msg('u1', null), msg('u1', null)])
    // null 同士は同日と見なせないため、毎回セパレータ扱いになる
    expect(flags.map((f) => f.showDate)).toEqual([true, true])
    expect(flags).toHaveLength(2)
  })

  it('入力と同じ長さの配列を返す', () => {
    const messages = Array.from({ length: 7 }, (_, i) =>
      msg(i % 2 === 0 ? 'u1' : 'u2', at(2026, 8, 11, 10, i)),
    )
    expect(computeMessageFlags(messages)).toHaveLength(7)
  })
})
