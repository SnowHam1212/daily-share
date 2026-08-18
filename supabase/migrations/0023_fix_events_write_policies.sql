-- ============================================================
-- 0023_fix_events_write_policies.sql
-- events の書き込みポリシーに所属チームの検査を足す（#116 / セキュリティ）
--
-- 症状:
--   events の書き込み側 RLS は 0001 のまま一度も見直されておらず、
--   **所属していないチームに予定を挿入・移動できる**。
--
--     CREATE POLICY "events_insert" ON events
--       FOR INSERT WITH CHECK ("createdBy" = auth.uid());
--
--     CREATE POLICY "events_update" ON events
--       FOR UPDATE USING ("createdBy" = auth.uid());
--
--   穴は2つ:
--
--   ① events_insert が "teamId" を検査していない
--      createdBy が自分であることしか見ていないため、teamId に任意の
--      チームの uuid を入れて挿入できる。挿入された予定はそのチームの
--      全メンバーのカレンダーに表示される。
--
--   ② events_update に WITH CHECK が無い
--      PostgreSQL では USING は「どの行を更新してよいか」を決めるだけで、
--      **更新後の行の内容は制約しない**。そのため自分のチームで予定を
--      作ってから teamId を任意のチームへ書き換えられる。①のように
--      相手チームの uuid を事前に知らなくても、一度作って移動すれば同じ。
--
--   読み取り側の同種の問題（#107）は 0021 で修正済み。本ファイルはその
--   書き込み側にあたる。
--
-- 安全性:
--   デプロイ済みのフロントは events への書き込みを3箇所しか持たない
--   （CalendarTab のみ。grep で確認済み）:
--
--     insert: { ...values, createdBy: user.id, teamId: teams[0].id }
--             teams は自分の所属チーム一覧なので所属は必ず成立する
--     update: update(values).eq('id', editingId)
--             values に teamId は含まれないので、更新でチームは移動しない
--     delete: delete().eq('id', id)  … 本ファイルでは触らない
--
--   よってこの厳格化で現行コードは壊れない。
--
--   ポリシー式から参照する user_teams は "userId" = auth.uid()
--   すなわち**自分の行**しか読まないため、0019 の回帰2（他人の行が
--   RLS で見えず EXISTS が成立しない）は起きない。
--
-- 既知の挙動変化:
--   チームを退出したあと、そのチームに残した自分の予定を**編集**できなく
--   なる（WITH CHECK が通らないため）。閲覧と削除は createdBy だけを見る
--   ので従来どおり可能。退出したチームの予定を書き換えられない方が
--   望ましいと判断してこの形にした。
-- ============================================================

DROP POLICY IF EXISTS "events_insert" ON events;

CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK (
    "createdBy" = auth.uid()
    AND "teamId" IN (
      SELECT "teamId" FROM user_teams WHERE "userId" = auth.uid()
    )
  );

DROP POLICY IF EXISTS "events_update" ON events;

CREATE POLICY "events_update" ON events
  FOR UPDATE
  -- どの行を更新できるか（更新前の行に対する判定）
  USING ("createdBy" = auth.uid())
  -- 更新後の行が満たすべき条件。これが無いと teamId を任意の
  -- チームへ書き換えられる。
  WITH CHECK (
    "createdBy" = auth.uid()
    AND "teamId" IN (
      SELECT "teamId" FROM user_teams WHERE "userId" = auth.uid()
    )
  );
