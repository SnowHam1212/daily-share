-- ============================================================
-- 0020_personal_events_and_import.sql
--
-- 1) 個人予定（チームに属さない予定）を作れるようにする
--    これまで events."teamId" は NOT NULL だったため、チームに参加して
--    いないユーザーは予定を 1 件も追加できなかった。
--
-- 2) 外部カレンダー（.ics）からのインポート用に、取り込み元を記録する
--    列を追加する。再インポート時の重複検出に使う。
--
-- どちらも「新しい経路を足すだけ」の追加変更で、既存のコード（常に
-- "teamId" を送り、externalUid を知らない）はそのまま動く。
-- docs/migration-deploy-runbook.md のとおり、適用はフロントエンドの
-- デプロイ後に行うこと。
-- ============================================================

-- ---------- 1) 個人予定 ----------

-- NULL = どのチームにも属さない、作成者だけの予定。
ALTER TABLE events ALTER COLUMN "teamId" DROP NOT NULL;

-- SELECT の条件を広げる（既存のチーム予定の見え方は変えない）。
DROP POLICY IF EXISTS "events_select" ON events;

CREATE POLICY "events_select" ON events
  FOR SELECT USING (
    -- 個人予定は作成者だけが見られる
    ("teamId" IS NULL AND "createdBy" = auth.uid())
    OR "teamId" IN (
      SELECT "teamId" FROM user_teams WHERE "userId" = auth.uid()
    )
  );

-- INSERT / UPDATE / DELETE は既存どおり "createdBy" = auth.uid() で、
-- "teamId" が NULL でもそのまま通る（ポリシーの変更は不要）。

-- 個人予定の一覧取得用。
CREATE INDEX IF NOT EXISTS idx_events_personal
  ON events ("createdBy")
  WHERE "teamId" IS NULL;


-- ---------- 2) 外部カレンダーのインポート ----------

-- .ics の UID。同じ予定を二重に取り込まないための照合キー。
ALTER TABLE events ADD COLUMN IF NOT EXISTS "externalUid" text;

-- 取り込み元の識別子（.ics の X-WR-CALNAME やファイル名）。表示用。
ALTER TABLE events ADD COLUMN IF NOT EXISTS "externalSource" text;

-- 「この UID はもう取り込んだか」を作成者ごとに引く。
CREATE INDEX IF NOT EXISTS idx_events_external_uid
  ON events ("createdBy", "externalUid")
  WHERE "externalUid" IS NOT NULL;
