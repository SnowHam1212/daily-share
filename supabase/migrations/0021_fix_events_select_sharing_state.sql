-- ============================================================
-- 0021_fix_events_select_sharing_state.sql
-- events_select が "sharingState" を見ていない問題を修正する（#107 / セキュリティ）
--
-- 症状:
--   同じチームに属してさえいれば、他人が private で作った予定まで
--   読めてしまう。0001 の events_select は teamId しか見ていない。
--
--     CREATE POLICY "events_select" ON events
--       FOR SELECT USING (
--         "teamId" IN (SELECT "teamId" FROM user_teams WHERE "userId" = auth.uid())
--       );
--
--   CalendarTab の公開範囲フィルタ（private / friends / team のチップ）は
--   取得済みの行を絞る**表示用**のもので、初期値は3つとも ON。
--   つまり既定の状態で他人の private な予定が画面に出ている。
--   フィルタで private を外しても、行はブラウザまで届いている。
--
--   locations_select は 0013 / 0019 で sharingState を見るよう直されたが、
--   events_select は 0001 のまま一度も更新されていなかった。
--
-- 修正後の可視範囲:
--   - 自分が作った予定       … 公開範囲に関係なく見える
--   - 他人の private        … 見えない（本修正の主眼）
--   - 他人の friends        … 同じチーム かつ 自分がフレンド登録している相手のみ
--   - 他人の team           … 同じチームのメンバーなら見える（従来どおり）
--
-- 安全性:
--   可視範囲を**狭めるだけ**で、新たに見えるようになる行は無い。
--   デプロイ済みのフロントは events を
--   `.select('*').in('teamId', teamIds)` で読むだけなので、
--   返る行が減ってもエラーにはならず、他人の private が消えるという
--   本来の挙動になる。よってコード側の変更は不要で、
--   runbook の「3段階に分ける」対象（古いコードが動かなくなる変更）には
--   当たらない。events を読むのは CalendarTab のみ（grep 済み）。
--
--   ポリシー式から参照する user_teams / user_friends は、どちらも
--   "userId" = auth.uid() すなわち**自分の行**しか読まないため、
--   0019 の回帰2（他人の行が RLS で見えず EXISTS が成立しない）は起きない。
--   SECURITY DEFINER のヘルパは不要。
-- ============================================================

DROP POLICY IF EXISTS "events_select" ON events;

CREATE POLICY "events_select" ON events
  FOR SELECT USING (
    -- 自分が作った予定は公開範囲を問わず見える
    "createdBy" = auth.uid()
    OR (
      -- 他人の予定は「同じチームに属していること」が大前提
      "teamId" IN (
        SELECT "teamId" FROM user_teams WHERE "userId" = auth.uid()
      )
      AND (
        "sharingState" = 'team'
        OR (
          -- 自分がフレンドとして登録している相手の予定のみ。
          -- user_friends は双方向に行を持つ（0005）。
          "sharingState" = 'friends'
          AND "createdBy" IN (
            SELECT "friendId" FROM user_friends WHERE "userId" = auth.uid()
          )
        )
      )
      -- "sharingState" = 'private' はどちらの分岐にも該当しないため、
      -- 作成者以外には返らない。
    )
  );
