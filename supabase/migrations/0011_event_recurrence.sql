-- ============================================================
-- 0011_event_recurrence.sql
-- 予定の繰り返し（なし/毎日/毎週/毎月）対応
--
-- マスター予定 1 行に繰り返しルールを持たせ、表示時にクライアント側で
-- 期間内のオカレンスへ展開する（シンプルな RRULE 相当）。
-- ============================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly'));

-- 繰り返しの終了日（その日まで。NULL は無期限）
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS "recurrenceEndDate" date;
