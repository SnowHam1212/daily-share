-- ============================================================
-- 0007_join_team_by_code.sql
-- 招待コードでチームに参加する RPC
--
-- teams_select policy はユーザーが既に所属するチームしか
-- SELECT を許可しないため、参加前のチームをクライアントから
-- 直接 invitationalCode で検索することはできない。
-- SECURITY DEFINER 関数で検索と user_teams への INSERT を
-- まとめて行うことで、teams テーブルの参照範囲を広げずに
-- 招待コード参加を実現する。
--
-- 注: フロントエンド（TeamSetup / TeamsTab）は既にこの RPC を
-- 呼び出しているが、関数定義のマイグレーションが欠けていた。
-- 本ファイルでマイグレーション履歴に取り込み、新規環境でも
-- 再現できるようにする。CREATE OR REPLACE のため再適用も安全。
-- （元 PR #68 / Issue #5 から番号を 0002→0007 に修正して切り出し）
-- ============================================================

DROP FUNCTION IF EXISTS public.join_team_by_code(text);

CREATE OR REPLACE FUNCTION public.join_team_by_code(code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
BEGIN
  SELECT id INTO v_team_id
  FROM teams
  WHERE "invitationalCode" = code;

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION '招待コードが見つかりません';
  END IF;

  INSERT INTO user_teams ("userId", "teamId", role)
  VALUES (auth.uid(), v_team_id, 'member')
  ON CONFLICT ("userId", "teamId") DO NOTHING;

  RETURN v_team_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_team_by_code(text) TO authenticated;
