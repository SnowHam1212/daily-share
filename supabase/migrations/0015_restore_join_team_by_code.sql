-- ============================================================
-- 0015_restore_join_team_by_code.sql
-- 招待コードでのチーム参加 RPC を本番に作り直す（バグ修正）
--
-- 経緯:
--   0007_join_team_by_code.sql は関数を定義しているが、本番には
--   関数が存在しなかった（REST から呼ぶと PGRST202）。
--   0007 という番号が 0007_location_team_sharing と重複しており、
--   Supabase の履歴テーブルはバージョン番号を主キーにするため
--   片方しか記録できない。結果 0007 は「適用済み」と判定され、
--   db push でも永久にスキップされる状態になっていた。
--   （番号重複自体は 0013 / 0014 へのリナンバーで解消済みだが、
--     すでに履歴へ記録された 0007 は再適用されないため、
--     新しい番号で入れ直す必要がある。）
--
-- なぜ RPC が要るか:
--   teams_select ポリシー（0001）は「自分が所属するチーム」しか
--   SELECT を許可しない。参加前は当然メンバーではないので、
--   クライアントから invitationalCode で teams を直接検索しても
--   必ず 0 件になる。SECURITY DEFINER 関数で検索と user_teams への
--   INSERT をまとめて行うことで、teams の参照範囲を広げずに
--   招待コード参加を実現する。
--
-- 同意について:
--   0012 で「他人をチームに入れるには本人の承諾が要る」方針にしたが、
--   招待コード参加は本人が自分でコードを入力する操作なので同意済みと
--   みなし、即参加のままとする。
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
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- 前後の空白は取り除く。コードをコピペで渡す運用のため。
  SELECT id INTO v_team_id
  FROM teams
  WHERE "invitationalCode" = btrim(code);

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION '招待コードが見つかりません';
  END IF;

  -- すでに参加済みなら何もしない（エラーにもしない）。
  INSERT INTO user_teams ("userId", "teamId", role)
  VALUES (auth.uid(), v_team_id, 'member')
  ON CONFLICT ("userId", "teamId") DO NOTHING;

  -- 招待を受け取ったまま未処理の行が残っていると、承諾済みなのに
  -- 「届いている招待」に出続けてしまうので片付ける（0012）。
  DELETE FROM team_invitations
  WHERE "teamId" = v_team_id AND "inviteeId" = auth.uid();

  RETURN v_team_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_team_by_code(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.join_team_by_code(text) FROM anon, public;
