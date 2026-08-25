-- ============================================================
-- 0025_message_reads.sql
-- トークの既読位置を保存する（#110 未読バッジ）
--
-- 背景:
--   team_messages（0003）は id / teamId / userId / body / createdAt だけで、
--   既読を表す列もテーブルも無かった。未読件数を出すには保存先が要る。
--
-- なぜ user_teams に "lastReadAt" を足さないのか（重要）:
--   issue #110 は最小構成として user_teams への列追加を挙げているが、
--   **この案は権限昇格の穴になる。**
--
--   user_teams には UPDATE ポリシーが存在しない（0001 / 0017 とも
--   select / insert / delete のみ）。既読を更新するには UPDATE を許す
--   必要があるが、素直に
--
--       CREATE POLICY ... FOR UPDATE USING ("userId" = auth.uid())
--
--   と書くと、同じ行の role 列も更新できてしまう:
--
--       UPDATE user_teams SET role = 'admin' WHERE "userId" = auth.uid();
--
--   RLS の WITH CHECK は**更新後の行しか見えない**ため、「role は据え置き」
--   を式で強制できない。防ぐにはトリガーが要る。チーム権限の中核テーブル
--   （CLAUDE.md「Team membership rules」）にその複雑さを持ち込むのは
--   割に合わない。
--
--   既読はチーム権限と何の関係も無い情報なので、独立したテーブルへ隔離する。
--   この表が持つのはタイムスタンプだけで、漏れても昇格に使えない。
--
-- 設計:
--   ("userId","teamId") を複合主キーにして 1 チーム 1 行。
--   upsert（onConflict: 'userId,teamId'）で既読位置を進める。
--   未読件数は team_messages を "lastReadAt" より新しいものに絞って
--   数える。行が無いチームは「一度も開いていない」として全件が未読。
--   team_messages は 30 日で自動削除される（0004）ので上限は自然に付く。
-- ============================================================

CREATE TABLE IF NOT EXISTS message_reads (
  "userId"     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "teamId"     uuid        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  "lastReadAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", "teamId")
);

ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

-- 自分の既読位置しか読めない。他人がどこまで読んだかは見せない。
CREATE POLICY "message_reads_select" ON message_reads
  FOR SELECT USING ("userId" = auth.uid());

-- 自分の行だけ、かつ所属しているチームについてのみ作れる。
-- user_teams は "userId" = auth.uid() すなわち自分の行しか読まないため、
-- user_teams_select を通る（0019 の回帰2は起きない）。
CREATE POLICY "message_reads_insert" ON message_reads
  FOR INSERT WITH CHECK (
    "userId" = auth.uid()
    AND "teamId" IN (
      SELECT "teamId" FROM user_teams WHERE "userId" = auth.uid()
    )
  );

-- 更新も同条件。WITH CHECK を書いて "userId" の付け替えを塞ぐ。
CREATE POLICY "message_reads_update" ON message_reads
  FOR UPDATE
  USING ("userId" = auth.uid())
  WITH CHECK (
    "userId" = auth.uid()
    AND "teamId" IN (
      SELECT "teamId" FROM user_teams WHERE "userId" = auth.uid()
    )
  );

CREATE POLICY "message_reads_delete" ON message_reads
  FOR DELETE USING ("userId" = auth.uid());
