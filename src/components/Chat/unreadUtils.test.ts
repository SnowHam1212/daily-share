import { describe, expect, it } from 'vitest'
import { countUnreadByTeam, formatBadgeCount, totalUnread } from './unreadUtils'

const ME = 'me'
const msg = (teamId: string, userId: string, createdAt: string | null) => ({
  teamId,
  userId,
  createdAt,
})

describe('countUnreadByTeam', () => {
  it('lastReadAt より新しい他人の投稿だけ数える', () => {
    const counts = countUnreadByTeam(
      [
        msg('t1', 'other', '2026-08-25T10:00:00Z'),
        msg('t1', 'other', '2026-08-25T09:00:00Z'), // 既読より古い
      ],
      new Map([['t1', '2026-08-25T09:30:00Z']]),
      ME,
    )
    expect(counts.get('t1')).toBe(1)
  })

  it('自分の投稿は数えない', () => {
    const counts = countUnreadByTeam(
      [msg('t1', ME, '2026-08-25T10:00:00Z'), msg('t1', 'other', '2026-08-25T10:00:00Z')],
      new Map(),
      ME,
    )
    expect(counts.get('t1')).toBe(1)
  })

  it('lastReadAt が無いチームは全件を未読にする', () => {
    const counts = countUnreadByTeam(
      [msg('t1', 'other', '2026-08-25T10:00:00Z'), msg('t1', 'other', '2026-01-01T00:00:00Z')],
      new Map(),
      ME,
    )
    expect(counts.get('t1')).toBe(2)
  })

  it('既読と同時刻は未読にしない（境界）', () => {
    const at = '2026-08-25T10:00:00Z'
    const counts = countUnreadByTeam([msg('t1', 'other', at)], new Map([['t1', at]]), ME)
    expect(counts.has('t1')).toBe(false)
  })

  it('createdAt が null の行は数えない', () => {
    const counts = countUnreadByTeam([msg('t1', 'other', null)], new Map(), ME)
    expect(counts.has('t1')).toBe(false)
  })

  it('チームごとに独立して数える', () => {
    const counts = countUnreadByTeam(
      [
        msg('t1', 'other', '2026-08-25T10:00:00Z'),
        msg('t2', 'other', '2026-08-25T10:00:00Z'),
        msg('t2', 'other', '2026-08-25T11:00:00Z'),
      ],
      new Map([['t1', '2026-08-25T09:00:00Z']]),
      ME,
    )
    expect(counts.get('t1')).toBe(1)
    expect(counts.get('t2')).toBe(2)
  })

  it('未読 0 のチームはキーを持たない', () => {
    const counts = countUnreadByTeam(
      [msg('t1', 'other', '2026-08-25T08:00:00Z')],
      new Map([['t1', '2026-08-25T09:00:00Z']]),
      ME,
    )
    expect(counts.has('t1')).toBe(false)
    expect(totalUnread(counts)).toBe(0)
  })

  it('currentUserId が未確定でも落ちない', () => {
    const counts = countUnreadByTeam([msg('t1', 'other', '2026-08-25T10:00:00Z')], new Map(), undefined)
    expect(counts.get('t1')).toBe(1)
  })
})

describe('totalUnread', () => {
  it('全チームの合計を返す', () => {
    expect(totalUnread(new Map([['t1', 2], ['t2', 3]]))).toBe(5)
  })
})

describe('formatBadgeCount', () => {
  it('9 以下はそのまま、10 以上は 9+', () => {
    expect(formatBadgeCount(1)).toBe('1')
    expect(formatBadgeCount(9)).toBe('9')
    expect(formatBadgeCount(10)).toBe('9+')
  })
})
