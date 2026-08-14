import { describe, it, expect } from 'vitest'
import { avatarColor, AVATAR_COLOR_COUNT } from './avatarColor'

describe('avatarColor', () => {
  it('同じ入力なら常に同じ色を返す', () => {
    const id = 'd6e1329f-0fb9-4962-8752-48601c00ad28'
    expect(avatarColor(id)).toBe(avatarColor(id))
  })

  it('null / undefined / 空文字はグレーにフォールバックする', () => {
    expect(avatarColor(null)).toBe('gray.400')
    expect(avatarColor(undefined)).toBe('gray.400')
    expect(avatarColor('')).toBe('gray.400')
  })

  it('必ず定義済みの色を返す（範囲外にならない）', () => {
    const colors = new Set<string>()
    for (let i = 0; i < 500; i++) colors.add(avatarColor(`user-${i}`))
    // gray へのフォールバックは起きない
    expect(colors.has('gray.400')).toBe(false)
    // 用意した色数を超えない
    expect(colors.size).toBeLessThanOrEqual(AVATAR_COLOR_COUNT)
  })

  it('用意した色をひと通り使う（1色に偏らない）', () => {
    const colors = new Set<string>()
    for (let i = 0; i < 200; i++) colors.add(avatarColor(`user-${i}`))
    expect(colors.size).toBe(AVATAR_COLOR_COUNT)
  })

  it('似た入力でも色が分かれる', () => {
    // UUID は先頭が似ることがあるため、末尾違いで分散するか確認する
    const a = avatarColor('00000000-0000-0000-0000-00000000000a')
    const b = avatarColor('00000000-0000-0000-0000-00000000000b')
    const c = avatarColor('00000000-0000-0000-0000-00000000000c')
    expect(new Set([a, b, c]).size).toBeGreaterThan(1)
  })

  it('日本語の表示名でも落ちない', () => {
    expect(avatarColor('田中太郎')).toMatch(/\./)
    expect(avatarColor('やまだ')).toMatch(/\./)
  })
})
