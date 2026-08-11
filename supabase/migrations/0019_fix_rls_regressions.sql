-- ============================================================
-- 0019_fix_rls_regressions.sql
-- 0016 / 0017 で RLS を本来の定義に戻したことによる回帰を修正する。
--
-- 回帰1: チーム作成が失敗する
--   フロントエンドは teams へ .insert().select() していた。.select() は
--   RETURNING を生成し、PostgreSQL は RETURNING で返る行にも SELECT
--   ポリシーを適用する。teams_select は「自分が所属するチーム」に限定
--   されているが、作成の瞬間はまだ user_teams に行が無いため 0 件になり、
--   .single() が失敗する。結果その後の admin 登録にも到達しない。
--
-- 回帰2: チームメイトの位置が見えない
--   locations_select の team 分岐は、相手の user_teams 行を読む必要が
--   ある。ポリシー式が別テーブルを参照すると、そのテーブルの RLS も
--   適用されるため、user_teams_select を「自分の行のみ」に戻した結果
--   EXISTS が成立しなくなった。events_select / team_messages_select は
--   自分の行しか読まないので影響を受けない。
-- ============================================================


-- ============================================================
-- SECTION 1: チーム作成を RPC に集約する（回帰1 / #89 / #92）
--
-- 作成と user_teams への admin 登録を1トランザクションにまとめる。
-- これにより以下がまとめて解決する:
--   - RETURNING が RLS に阻まれる問題（作成者はまだメンバーではない）
--   - 途中で失敗するとメンバー0人の孤児チームが残る問題（#89）
--   - 匿名でも teams に行を作れる問題（#92）
--   - 招待コードが衝突すると UNIQUE 制約で失敗する問題（#89）
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_team(
  p_team_name      text,
  p_removal_policy text DEFAULT 'admin_only'
)
RETURNS TABLE (id uuid, team_name text, invitational_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name    text := btrim(p_team_name);
  v_code    text;
  v_team_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF v_name = '' THEN
    RAISE EXCEPTION 'チーム名を入力してください';
  END IF;

  IF p_removal_policy NOT IN ('admin_only', 'anyone', 'nobody') THEN
    RAISE EXCEPTION 'removalPolicy が不正です';
  END IF;

  -- 衝突したら引き直す。クライアント側の Math.random() では
  -- 重複時に UNIQUE 制約で失敗するだけだった。
  LOOP
    v_code := substr(md5(gen_random_uuid()::text), 1, 6);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM teams WHERE "invitationalCode" = v_code);
  END LOOP;

  INSERT INTO teams ("teamName", "invitationalCode", "removalPolicy")
  VALUES (v_name, v_code, p_removal_policy)
  RETURNING teams.id INTO v_team_id;

  -- 作成者を管理者として登録する。同一トランザクションなので、
  -- ここで失敗すればチームの作成ごとロールバックされる。
  INSERT INTO user_teams ("userId", "teamId", role)
  VALUES (auth.uid(), v_team_id, 'admin');

  RETURN QUERY SELECT v_team_id, v_name, v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_team(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_team(text, text) FROM anon, public;

-- teams への直接 INSERT は不要になったので塞ぐ。
-- 0016 で auth.uid() IS NOT NULL に絞ったが、RPC に集約した以上
-- ポリシー自体を落として直接の作成経路を無くす。
DROP POLICY IF EXISTS "teams_insert" ON teams;


-- ============================================================
-- SECTION 2: locations_select の team 分岐を修正する（回帰2）
--
-- ポリシー式から user_teams を直接読むと、user_teams 側の RLS が
-- 適用されて相手の所属行が見えない。SECURITY DEFINER のヘルパを
-- 経由することで RLS を迂回し、判定だけを安全に行う。
-- 0012 の is_team_member と同じ方式。
-- ============================================================

-- 位置情報の所有者と閲覧者が同じチームに属しているか。
-- p_shared_team_ids が空なら「所有者が属する全チーム」へ共有とみなす
-- （0013 の従来挙動を維持）。
CREATE OR REPLACE FUNCTION public.shares_team_for_location(
  p_owner_id        uuid,
  p_shared_team_ids uuid[]
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   user_teams owner_ut
    JOIN   user_teams viewer_ut ON owner_ut."teamId" = viewer_ut."teamId"
    WHERE  owner_ut."userId"  = p_owner_id
      AND  viewer_ut."userId" = auth.uid()
      AND  (
        cardinality(p_shared_team_ids) = 0
        OR owner_ut."teamId" = ANY(p_shared_team_ids)
      )
  );
$$;

-- NOTE: ポリシー式の評価は問い合わせユーザーの権限で行われるため、
--       この関数には EXECUTE 権限が必要。REVOKE すると
--       locations の SELECT 自体が permission denied になる。
--       関数が返すのは「自分と相手が同じチームか」という真偽値だけで、
--       呼び出し元が既に持っている関係以上の情報は漏れない。
GRANT EXECUTE ON FUNCTION public.shares_team_for_location(uuid, uuid[]) TO authenticated;

DROP POLICY IF EXISTS "locations_select" ON locations;

CREATE POLICY "locations_select" ON locations
  FOR SELECT USING (
    -- private: 本人のみ
    ("sharingState" = 'private' AND "userId" = auth.uid())
    OR
    -- friends: 本人、または自分がフレンドとして登録している相手
    --   user_friends は自分の行しか見えないが、ここで読むのは
    --   自分の行（"userId" = auth.uid()）なので RLS の影響を受けない。
    ("sharingState" = 'friends' AND (
      "userId" = auth.uid()
      OR "userId" IN (
        SELECT "friendId" FROM user_friends WHERE "userId" = auth.uid()
      )
    ))
    OR
    -- team: 本人、または共有先チームを共有しているメンバー
    ("sharingState" = 'team' AND (
      "userId" = auth.uid()
      OR public.shares_team_for_location("userId", "sharedTeamIds")
    ))
  );
