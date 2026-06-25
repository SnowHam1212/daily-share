-- ============================================================
-- 0009_harden_handle_new_user.sql
-- handle_new_user() トリガー関数のセキュリティ強化:
--   * SET search_path を固定（search_path 注入による権限昇格を防止）
--
-- handle_new_user は auth.users への INSERT 毎に、関数所有者
-- （= migration 実行ロール）の権限で実行される SECURITY DEFINER
-- 関数。search_path が固定されていないと、呼び出し元セッションの
-- search_path 次第で意図しないスキーマの users / now() 等が解決され、
-- 権限昇格に悪用されうる。0008 と同じ方針で search_path を固定する。
--
-- 関数本体は 0001 と同一。CREATE OR REPLACE で冪等。
-- トリガー（on_auth_user_created）は関数を参照しているだけなので
-- 貼り直し不要。
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.users (id, email, "displayName", "createdAt")
  VALUES (
    NEW.id,
    NEW.email,
    '',         -- displayName は後で UPDATE
    NOW()
  );
  RETURN NEW;
END;
$$;
