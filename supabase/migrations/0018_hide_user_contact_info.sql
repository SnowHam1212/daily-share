-- ============================================================
-- 0018_hide_user_contact_info.sql
-- users の連絡先を他人から見えなくする（セキュリティ修正）
--
-- 問題:
--   users_select は 0001 の時点から USING (true) で、匿名を含む誰でも
--   全行・全カラムを読めた。実際に本番から全ユーザーのメールアドレスを
--   取得できることを確認している。
--
-- 方針（Instagram / X と同じ考え方）:
--   検索できること自体は問題ではない。公開してよい情報（表示名）と、
--   絶対に出さない情報（メール・電話・生年月日）を分けるのが本質。
--   あちらも表示名やユーザー名は部分一致で誰でも探せるが、
--   メールアドレスは決して他人に返さない。
--
--   Postgres の RLS は行単位で列を制御できないため、
--     - テーブルへの直接 SELECT は「自分の行のみ」に絞る
--     - 公開情報だけを返す RPC を用意する
--   という形にする。これにより検索の使い勝手は変えずに漏洩だけ止まる。
--
-- 注意:
--   表示名は重複を許すため、同名ユーザーの見分けが付かなくなる。
--   Instagram / X の @ユーザー名にあたる一意の識別子は現状無い。
--   導入は別 issue とし、ここでは漏洩を止めることを優先する。
-- ============================================================


-- ============================================================
-- users: 自分の行のみ直接 SELECT できる
-- ============================================================

DROP POLICY IF EXISTS "users_select" ON users;

CREATE POLICY "users_select" ON users
  FOR SELECT USING (id = auth.uid());

-- 他人の表示名は下の RPC 経由でのみ取得する。


-- ============================================================
-- 公開プロフィールの取得（ID 指定）
--
-- フレンド一覧・地図のピン・トークルームの招待候補など、
-- 「関係のある相手の名前を出す」用途で使う。
-- 返すのは id と表示名だけで、メール等は一切含まない。
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_profiles(p_ids uuid[])
RETURNS TABLE (id uuid, display_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT u.id, u."displayName"
  FROM users u
  WHERE u.id = ANY(p_ids)
    AND auth.uid() IS NOT NULL;
$$;


-- ============================================================
-- ユーザー検索（表示名の部分一致）
--
-- 従来のフロントエンドは users を直接 ilike で引いていたが、
-- その結果にメールアドレスが含まれていた。表示名だけを返すことで
-- 検索体験を維持したまま連絡先の漏洩を止める。
--
-- メールアドレスでの検索も残す。ただし部分一致だと総当たりで
-- アドレスを探れてしまうため、完全一致のみとする。
-- 「相手のメールを知っている人が追加する」用途は満たせる。
-- ============================================================

CREATE OR REPLACE FUNCTION public.search_users(p_query text)
RETURNS TABLE (id uuid, display_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_query text := btrim(p_query);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- 短すぎるクエリは名簿の総なめに近くなるので弾く。
  IF length(v_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT u.id, u."displayName"
    FROM users u
    WHERE u.id <> auth.uid()
      AND (
        u."displayName" ILIKE '%' || v_query || '%'
        OR lower(u.email) = lower(v_query)   -- メールは完全一致のみ
      )
    ORDER BY u."displayName"
    LIMIT 20;
END;
$$;


-- ============================================================
-- 自分と同じチームに属する全ユーザー（地図のピン表示用）
--
-- MapTab は user_teams を .in('teamId', teamIds) で直接引いて
-- チームメイトの id を集めていたが、user_teams_select（0017 で
-- 本来の定義に戻した）は自分の行しか返さないため機能しない。
-- 地図は表示名の有無でピンを出し分けているので、これが欠けると
-- フレンドでないチームメイトが地図から消える。
--
-- 所属チームをまたいで重複を除いた一覧を1回で返す。
-- ============================================================

CREATE OR REPLACE FUNCTION public.list_my_teammates()
RETURNS TABLE (id uuid, display_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT u.id, u."displayName"
  FROM user_teams mine
  JOIN user_teams theirs ON theirs."teamId" = mine."teamId"
  JOIN users u ON u.id = theirs."userId"
  WHERE mine."userId" = auth.uid()
    AND auth.uid() IS NOT NULL;
$$;


-- ============================================================
-- GRANT
-- ============================================================

GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users(text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_teammates()         TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.search_users(text)          FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_my_teammates()         FROM anon, public;
