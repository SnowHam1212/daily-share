-- ============================================================
-- 0024_personal_events_and_import.sql
--
-- 1) 個人予定（チームに属さない予定）を作れるようにする
--    これまで events."teamId" は NOT NULL だったため、チームに参加して
--    いないユーザーは予定を 1 件も追加できなかった。
--
-- 2) 外部カレンダー（.ics）からのインポート用に、取り込み元を記録する
--    列を追加する。再インポート時の重複検出に使う。
--
-- docs/migration-deploy-runbook.md のとおり、適用はフロントエンドの
-- デプロイ後に行うこと。
--
-- ------------------------------------------------------------
-- NOTE: 0020 -> 0024 にリナンバーした（2026-08-17）
--
--   main には既に 0020_restore_event_timezone.sql があり、番号が
--   重複していた。Supabase の履歴テーブルはバージョン番号を主キーに
--   するため、重複すると片方が「適用済み」と記録されたまま中身が
--   本番に入らない。過去に 0007 / 0008 で2回起こした事故と同じ形。
--
-- NOTE: events のポリシーを 0021 / 0023 と整合させた（2026-08-17）
--
--   このファイルの元版は events_select を
--
--     ("teamId" IS NULL AND "createdBy" = auth.uid())
--     OR "teamId" IN (SELECT ... FROM user_teams ...)
--
--   と定義し直していた。しかしこの間に以下が入っている:
--
--     0021 … events_select に "sharingState" の判定を追加（#107）
--            他人の private な予定が同じチームの全員に見えていた漏洩の修正
--     0023 … events_insert / events_update に所属チームの検査を追加（#116）
--
--   番号が後になる本ファイルのポリシー定義が最後に適用されるため、
--   元版のままだと **0021 の修正を打ち消して #107 の漏洩が復活する**。
--   また 0023 の WITH CHECK は "teamId" IN (...) なので、個人予定の
--   "teamId" = NULL は `NULL IN (...)` → NULL となり **個人予定の
--   作成・更新が弾かれる**。
--
--   そのため本ファイルで3つのポリシーを「個人予定 ＋ sharingState ＋
--   所属チーム検査」をすべて満たす形で定義し直す。self-contained に
--   書いてあるので、0021 / 0023 の適用有無に関わらず正しく効く。
--
--   **以後 events のポリシーを変更するときは、番号が最大のこの定義を
--     必ず一緒に更新すること。**
-- ============================================================

-- ---------- 1) 個人予定 ----------

-- NULL = どのチームにも属さない、作成者だけの予定。
ALTER TABLE events ALTER COLUMN "teamId" DROP NOT NULL;


-- ---------- events のポリシーを再定義（0021 / 0023 を包含する） ----------

DROP POLICY IF EXISTS "events_select" ON events;

CREATE POLICY "events_select" ON events
  FOR SELECT USING (
    -- 自分が作った予定は、公開範囲にもチームにも関係なく見える。
    -- 個人予定（"teamId" IS NULL）もここで拾われる。
    "createdBy" = auth.uid()
    OR (
      -- 他人の予定は「同じチームに属していること」が大前提。
      -- 他人の個人予定は "teamId" が NULL なので `NULL IN (...)` → NULL
      -- となり、この分岐に入らない（＝見えない）。
      "teamId" IN (
        SELECT "teamId" FROM user_teams WHERE "userId" = auth.uid()
      )
      AND (
        "sharingState" = 'team'
        OR (
          -- 自分がフレンドとして登録している相手の予定のみ。
          "sharingState" = 'friends'
          AND "createdBy" IN (
            SELECT "friendId" FROM user_friends WHERE "userId" = auth.uid()
          )
        )
      )
      -- "sharingState" = 'private' はどちらの分岐にも該当しないため、
      -- 作成者以外には返らない（0021 / #107）。
    )
  );

DROP POLICY IF EXISTS "events_insert" ON events;

CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK (
    "createdBy" = auth.uid()
    AND (
      -- 個人予定はチームに属さないので NULL を許す。
      "teamId" IS NULL
      -- チーム予定は自分が所属しているチームに限る（0023 / #116）。
      OR "teamId" IN (
        SELECT "teamId" FROM user_teams WHERE "userId" = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "events_update" ON events;

CREATE POLICY "events_update" ON events
  FOR UPDATE
  -- どの行を更新できるか（更新前の行に対する判定）
  USING ("createdBy" = auth.uid())
  -- 更新後の行が満たすべき条件。これが無いと "teamId" を任意のチームへ
  -- 書き換えられる（0023 / #116）。本ブランチのフロントは更新時にも
  -- "teamId" を送る（個人予定 ⇔ チーム予定の切り替えができる）ため、
  -- ここの判定が実際に効く。
  WITH CHECK (
    "createdBy" = auth.uid()
    AND (
      "teamId" IS NULL
      OR "teamId" IN (
        SELECT "teamId" FROM user_teams WHERE "userId" = auth.uid()
      )
    )
  );

-- DELETE は "createdBy" = auth.uid() のままで、"teamId" が NULL でも通る。

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
