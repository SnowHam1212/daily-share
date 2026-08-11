-- ============================================================
-- 0016_restore_team_rls_policies.sql
-- teams / user_teams の SELECT ポリシーを本来の定義に戻す（セキュリティ修正）
--
-- 経緯:
--   本番の teams_select / user_teams_select が、動作確認のために
--   手作業で USING (true) に書き換えられ、そのまま戻されていなかった。
--   ポリシーの対象ロールは public（anon を含む）なので、
--   ログイン不要で以下がすべて読み出せる状態だった:
--     - 全ユーザーのメールアドレス・電話番号・生年月日（users）
--     - 全チームの invitationalCode（teams）
--     - 誰がどのチームに所属しているか（user_teams）
--   招待コードが読めるということは、誰でも任意のチームに参加でき、
--   そのメンバーの位置情報と予定が見えるということでもある。
--
-- 順序の注意:
--   TeamsTab のメンバー一覧が user_teams を直接引いていたため、
--   ポリシーを厳しくすると「メンバーが自分1人」になってしまう。
--   本マイグレーションと同じコミットで list_team_members RPC 経由に
--   置き換えてある。フロントエンドを先に直さないと画面が壊れる。
--
-- 冪等性:
--   ALTER POLICY はポリシーが無いと失敗するため、
--   DROP POLICY IF EXISTS + CREATE POLICY で書き直す。
-- ============================================================


-- ============================================================
-- teams: 自分が所属するチームのみ SELECT 可
-- ============================================================

DROP POLICY IF EXISTS "teams_select" ON teams;

CREATE POLICY "teams_select" ON teams
  FOR SELECT USING (
    id IN (
      SELECT "teamId" FROM user_teams WHERE "userId" = auth.uid()
    )
  );

-- 参加前のチームを invitationalCode で探す必要があるが、それは
-- join_team_by_code（SECURITY DEFINER・0015）が担当する。
-- クライアントから teams を直接検索する経路は塞いだままにする。


-- ============================================================
-- user_teams: 自分の所属行のみ SELECT 可
-- ============================================================

DROP POLICY IF EXISTS "user_teams_select" ON user_teams;

CREATE POLICY "user_teams_select" ON user_teams
  FOR SELECT USING ("userId" = auth.uid());

-- チームのメンバー一覧は list_team_members（SECURITY DEFINER・0012）で取得する。


-- ============================================================
-- teams への INSERT を認証済みユーザーに限定する
--
-- 0001 の teams_insert は WITH CHECK (true) で、anon を含む誰でも
-- 行を作成できた（実際に匿名で作成できることを確認済み）。
-- teams には DELETE ポリシーが無いため「作れるが消せない」構造になり、
-- スパム登録・孤児チームの量産・invitationalCode の枯渇を許していた。
--
-- なお本来はチーム作成自体を SECURITY DEFINER の RPC に集約し、
-- teams への直接 INSERT を塞ぐのが望ましい（作成と user_teams への
-- admin 登録を1トランザクションにできるため）。それは別 issue とし、
-- ここでは匿名による作成だけを止める。
-- ============================================================

DROP POLICY IF EXISTS "teams_insert" ON teams;

CREATE POLICY "teams_insert" ON teams
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================================
-- NOTE: users_select は本マイグレーションでは変更しない。
--
-- users_select は 0001 の時点から USING (true) で、匿名を含む全員に
-- 全行・全カラムを開放している。これは「書き換えられた」ものではなく
-- 当初からの定義であり、フレンド検索がここに依存している。
-- 絞るにはメールアドレス完全一致で最小限のカラムだけ返す RPC を
-- 用意するなど、機能面の設計変更を伴うため別途対応する。
-- ============================================================
