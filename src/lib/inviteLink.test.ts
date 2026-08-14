import { describe, it, expect } from 'vitest'
import { parseInviteCode, buildInviteUrl } from './inviteLink'

describe('parseInviteCode', () => {
  it('招待リンクからコードを取り出す', () => {
    expect(parseInviteCode('/join/a1b2c3')).toBe('a1b2c3')
  })

  it('末尾スラッシュを無視する', () => {
    expect(parseInviteCode('/join/a1b2c3/')).toBe('a1b2c3')
    expect(parseInviteCode('/join/a1b2c3///')).toBe('a1b2c3')
  })

  it('クエリとハッシュを落とす', () => {
    expect(parseInviteCode('/join/a1b2c3?from=line')).toBe('a1b2c3')
    expect(parseInviteCode('/join/a1b2c3#top')).toBe('a1b2c3')
  })

  it('パスの大文字小文字を吸収する', () => {
    expect(parseInviteCode('/JOIN/a1b2c3')).toBe('a1b2c3')
  })

  it('コード自体の大文字小文字は保つ', () => {
    // 過去に Math.random().toString(36) で作られたコードが残っている
    expect(parseInviteCode('/join/A1B2c3')).toBe('A1B2c3')
  })

  it('招待リンク以外は null', () => {
    expect(parseInviteCode('/')).toBeNull()
    expect(parseInviteCode('/teams')).toBeNull()
    expect(parseInviteCode('/joinx/abc')).toBeNull()
    expect(parseInviteCode('')).toBeNull()
  })

  it('コードが無ければ null', () => {
    expect(parseInviteCode('/join/')).toBeNull()
    expect(parseInviteCode('/join')).toBeNull()
  })

  it('さらに階層があるものは受け付けない', () => {
    expect(parseInviteCode('/join/abc/def')).toBeNull()
  })

  it('英数字以外を含むコードは受け付けない', () => {
    expect(parseInviteCode('/join/abc-def')).toBeNull()
    expect(parseInviteCode('/join/<script>')).toBeNull()
    expect(parseInviteCode('/join/あいうえお')).toBeNull()
  })

  it('長すぎるコードは受け付けない', () => {
    expect(parseInviteCode(`/join/${'a'.repeat(33)}`)).toBeNull()
    expect(parseInviteCode(`/join/${'a'.repeat(32)}`)).toBe('a'.repeat(32))
  })
})

describe('buildInviteUrl', () => {
  it('origin とコードからリンクを作る', () => {
    expect(buildInviteUrl('https://example.com', 'a1b2c3')).toBe('https://example.com/join/a1b2c3')
  })

  it('origin の末尾スラッシュを重複させない', () => {
    expect(buildInviteUrl('https://example.com/', 'a1b2c3')).toBe('https://example.com/join/a1b2c3')
  })

  it('作ったリンクは解析して元のコードに戻る', () => {
    const url = buildInviteUrl('https://example.com', 'a1b2c3')
    expect(parseInviteCode(new URL(url).pathname)).toBe('a1b2c3')
  })
})
