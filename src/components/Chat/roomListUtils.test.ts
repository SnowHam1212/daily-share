import { describe, it, expect } from 'vitest'
import {
  formatListTime,
  previewTime,
  foldLatestByTeam,
  orderTeamsByRecency,
  withNewerMessage,
  type Preview,
} from './roomListUtils'

// 日時はローカル時刻で組み立てる。formatListTime は閲覧者のローカル
// タイムゾーンで「今日かどうか」を判定するため、こうしておくと実行環境の
// TZ に依らずアサーションが安定する（calendarUtils.test.ts と同じ方針）。
function at(y: number, m: number, d: number, h = 12, min = 0) {
  return new Date(y, m - 1, d, h, min).toISOString()
}

function row(teamId: string, body: string, createdAt: string | null) {
  return { teamId, body, createdAt }
}

function preview(time: number): Preview {
  return { body: 'x', createdAt: null, time }
}

describe('formatListTime', () => {
  const now = new Date(2026, 7, 11, 15, 0) // 2026-08-11 15:00 ローカル

  it('今日なら時刻を出す', () => {
    expect(formatListTime(at(2026, 8, 11, 9, 5), now)).toBe('09:05')
  })

  it('別の日なら月/日を出す', () => {
    expect(formatListTime(at(2026, 8, 10, 9, 5), now)).toBe('8/10')
  })

  it('1年前の同月同日は日付表示になる', () => {
    expect(formatListTime(at(2025, 8, 11, 9, 5), now)).toBe('8/11')
  })

  it('null は空文字', () => {
    expect(formatListTime(null, now)).toBe('')
  })
})

describe('previewTime', () => {
  it('null は 0', () => {
    expect(previewTime(null)).toBe(0)
  })

  it('パースできない文字列は 0（NaN を漏らさない）', () => {
    expect(previewTime('not-a-date')).toBe(0)
  })

  it('妥当な日時は数値になる', () => {
    expect(previewTime(at(2026, 8, 11))).toBeGreaterThan(0)
  })
})

describe('foldLatestByTeam', () => {
  it('teamId ごとに最初に現れた行を採用する', () => {
    // 取得は新しい順なので、最初に現れたものが最新
    const map = foldLatestByTeam([
      row('B', 'newest B', at(2026, 8, 11, 10, 0)),
      row('A', 'newest A', at(2026, 8, 11, 9, 0)),
      row('B', 'older B', at(2026, 8, 11, 8, 0)),
    ])
    expect(map.get('B')?.body).toBe('newest B')
    expect(map.get('A')?.body).toBe('newest A')
  })

  it('チーム数ぶんだけエントリを作る', () => {
    const map = foldLatestByTeam([
      row('A', '1', at(2026, 8, 11)),
      row('A', '2', at(2026, 8, 10)),
      row('B', '3', at(2026, 8, 9)),
    ])
    expect(map.size).toBe(2)
  })

  it('空配列なら空のマップ', () => {
    expect(foldLatestByTeam([]).size).toBe(0)
  })

  it('createdAt が null でも time が 0 で入る', () => {
    const map = foldLatestByTeam([row('A', 'x', null)])
    expect(map.get('A')).toEqual({ body: 'x', createdAt: null, time: 0 })
  })
})

describe('orderTeamsByRecency', () => {
  const teams = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }]

  it('最新のルームを先頭に、未発言のルームを末尾にする', () => {
    const previews = new Map([
      ['A', preview(100)],
      ['B', preview(300)],
      ['C', preview(200)],
      // D は未発言
    ])
    expect(orderTeamsByRecency(teams, previews).map((t) => t.id)).toEqual(['B', 'C', 'A', 'D'])
  })

  it('全て未発言なら元の順序を保つ', () => {
    expect(orderTeamsByRecency(teams, new Map()).map((t) => t.id)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('同じ時刻なら元の順序を保つ', () => {
    const previews = new Map([
      ['A', preview(100)],
      ['B', preview(100)],
      ['C', preview(100)],
      ['D', preview(100)],
    ])
    expect(orderTeamsByRecency(teams, previews).map((t) => t.id)).toEqual(['A', 'B', 'C', 'D'])
  })

  it('元の配列を書き換えない', () => {
    const original = [...teams]
    orderTeamsByRecency(teams, new Map([['D', preview(999)]]))
    expect(teams).toEqual(original)
  })
})

describe('withNewerMessage', () => {
  it('新しいメッセージなら差し替える', () => {
    const before = new Map([['A', { body: 'old', createdAt: at(2026, 8, 11, 9, 0), time: 100 }]])
    const after = withNewerMessage(before, row('A', 'new', at(2026, 8, 11, 10, 0)))
    expect(after.get('A')?.body).toBe('new')
  })

  it('古いメッセージが遅れて届いても上書きしない', () => {
    // 取得と Realtime の到着順が前後した場合を想定
    const newer = at(2026, 8, 11, 10, 0)
    const older = at(2026, 8, 11, 9, 0)
    const before = new Map([
      ['A', { body: 'newest', createdAt: newer, time: Date.parse(newer) }],
    ])
    const after = withNewerMessage(before, row('A', 'stale', older))
    expect(after.get('A')?.body).toBe('newest')
  })

  it('変化が無ければ同じ参照を返す（不要な再描画を避ける）', () => {
    const iso = at(2026, 8, 11, 10, 0)
    const before = new Map([['A', { body: 'same', createdAt: iso, time: Date.parse(iso) }]])
    expect(withNewerMessage(before, row('A', 'stale', iso))).toBe(before)
  })

  it('未知のチームなら新規に追加する', () => {
    const before = new Map<string, Preview>()
    const after = withNewerMessage(before, row('Z', 'hello', at(2026, 8, 11)))
    expect(after.get('Z')?.body).toBe('hello')
    expect(before.size).toBe(0) // 元のマップは変更しない
  })
})
