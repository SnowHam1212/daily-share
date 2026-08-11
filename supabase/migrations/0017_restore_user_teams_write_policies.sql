-- ============================================================
-- 0017_restore_user_teams_write_policies.sql
-- user_teams の書き込みポリシーを本来の定義に戻す（セキュリティ修正）
--
-- 経緯:
--   0016 で SELECT 系を戻したあと、user_teams_insert も
--   WITH CHECK (true) に書き換えられていることが判明した。
--   0016 と同じく、動作確認のために緩めて戻し忘れたもの。
--
-- 何が起きるか:
--   対象ロールが public（anon を含む）かつ WITH CHECK (true) なので、
--   ログインしていなくても任意の userId / teamId の組で行を作れる。
--   実在する ID を使えば、任意のユーザーを任意のチームに参加させられる。
--
--   これは 0012 で入れた「チームへの参加は必ず本人の同意を要件とする」
--   という設計を根本から迂回する。招待 → 承諾のフローを整えても、
--   テーブルを直接叩けば同意なしに他人を放り込めてしまう。
--   参加させられた相手の位置情報と予定が、そのチームから見える。
--
-- 正規の参加経路はいずれも SECURITY DEFINER の RPC で、本ポリシーの
-- 影響を受けない:
--   - join_team_by_code   … 招待コードによる参加（0015）
--   - accept_team_invitation … 招待の承諾（0012）
--   - チーム作成時の admin 登録 … クライアントからの直接 INSERT だが
--     自分の行なので "userId" = auth.uid() を満たす
-- ============================================================


-- ============================================================
-- user_teams: 自分の行のみ作成できる
-- ============================================================

DROP POLICY IF EXISTS "user_teams_insert" ON user_teams;

CREATE POLICY "user_teams_insert" ON user_teams
  FOR INSERT WITH CHECK ("userId" = auth.uid());


-- ============================================================
-- user_teams: 自分の行のみ削除できる（退出）
--
-- 0001 の定義と同じだが、こちらも緩められていないか確認できて
-- いないため、あわせて明示的に貼り直しておく。
-- 他メンバーの追放は remove_team_member（SECURITY DEFINER・0012）が
-- 担当し、teams."removalPolicy" に従って権限を判定する。
-- ============================================================

DROP POLICY IF EXISTS "user_teams_delete" ON user_teams;

CREATE POLICY "user_teams_delete" ON user_teams
  FOR DELETE USING ("userId" = auth.uid());
