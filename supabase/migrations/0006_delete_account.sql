-- ============================================================
-- 0006_delete_account.sql
-- 本人によるアカウント削除（auth.users を削除し、関連データは CASCADE）
-- ============================================================

-- auth.users を削除する権限が必要なため SECURITY DEFINER（migration 実行ロール所有）。
-- public.* の各テーブルは users(id) を ON DELETE CASCADE で参照しているため、
-- この削除で当該ユーザーの全データ（teams 所属/予定/位置/フレンド/メッセージ等）が消える。
CREATE OR REPLACE FUNCTION delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION delete_own_account() FROM public;
GRANT EXECUTE ON FUNCTION delete_own_account() TO authenticated;
