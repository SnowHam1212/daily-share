import { useCallback, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type EventRow = Database['public']['Tables']['events']['Row']

const POLL_MS = 30_000 // どのくらいの頻度で「通知すべき予定」を確認するか
const LOOKAHEAD_MS = 2 * 24 * 60 * 60 * 1000 // 先読みする期間（2日）
const FIRED_KEY = 'firedReminders' // localStorage キー

// 既に通知した予定を localStorage に保持し、リロードや再ポーリングでの
// 重複通知を防ぐ。キーは id@startAt（開始時刻が変わったら再通知される）。
function loadFired(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveFired(map: Record<string, number>) {
  // 3日より古いエントリは掃除する。
  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000
  const pruned = Object.fromEntries(Object.entries(map).filter(([, t]) => t > cutoff))
  localStorage.setItem(FIRED_KEY, JSON.stringify(pruned))
}

function fireKey(ev: EventRow): string {
  return `${ev.id}@${ev.startAt}`
}

interface Options {
  teamIds: string[]
  // 通知UI（トースト等）。ブラウザ通知が不可/拒否でも必ず呼ばれる。
  onReminder: (ev: EventRow) => void
}

/**
 * 開始前リマインダー: アプリ起動中、reminderMinutes が設定された
 * 直近の予定を定期的に確認し、通知時刻に達したらブラウザ通知＋onReminder
 * を発火する。バックグラウンド配信（Web Push）は #50 で対応予定。
 */
export function useEventReminders({ teamIds, onReminder }: Options) {
  const onReminderRef = useRef(onReminder)
  useEffect(() => {
    onReminderRef.current = onReminder
  }, [onReminder])

  const check = useCallback(async () => {
    if (teamIds.length === 0) return
    const now = Date.now()
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .in('teamId', teamIds)
      .not('reminderMinutes', 'is', null)
      .gt('startAt', new Date(now - 60_000).toISOString())
      .lt('startAt', new Date(now + LOOKAHEAD_MS).toISOString())
    if (error || !data) return

    const fired = loadFired()
    let changed = false

    for (const ev of data as EventRow[]) {
      if (ev.reminderMinutes === null) continue
      const startMs = new Date(ev.startAt).getTime()
      const fireAt = startMs - ev.reminderMinutes * 60_000
      const key = fireKey(ev)
      // 通知時刻を過ぎていて、まだ開始しておらず、未通知のものを発火。
      if (now >= fireAt && now < startMs && !fired[key]) {
        fired[key] = now
        changed = true
        notify(ev)
        onReminderRef.current(ev)
      }
    }

    if (changed) saveFired(fired)
  }, [teamIds])

  useEffect(() => {
    void check()
    const id = setInterval(() => void check(), POLL_MS)
    return () => clearInterval(id)
  }, [check])
}

function notify(ev: EventRow) {
  if (typeof Notification === 'undefined') return
  const body = formatWhen(ev)
  if (Notification.permission === 'granted') {
    try {
      new Notification(`まもなく: ${ev.name}`, { body, tag: ev.id })
    } catch {
      // ignore（権限はあるが発火に失敗するケース）
    }
  } else if (Notification.permission === 'default') {
    // 次回以降のために権限を要求（拒否でもトーストは出る）。
    void Notification.requestPermission()
  }
}

function formatWhen(ev: EventRow): string {
  const t = new Date(ev.startAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  return ev.isAllDay ? '本日の予定' : `${t} 開始`
}
