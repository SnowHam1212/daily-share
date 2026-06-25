-- ============================================================
-- 0008_harden_definer_functions.sql
-- SECURITY DEFINER 関数のセキュリティ強化:
--   * SET search_path を固定（search_path 注入による権限昇格を防止）
--   * 実行権限を authenticated に限定（PUBLIC からは REVOKE）
--
-- 関数本体は既存（0004/0005）と同一。CREATE OR REPLACE で冪等。
-- delete_own_account（0006）は既に対策済みのため対象外。
-- ============================================================

-- ---------- フレンド申請の承認（双方向 user_friends を作成） ----------
CREATE OR REPLACE FUNCTION accept_friend_request(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  req friend_requests%ROWTYPE;
BEGIN
  SELECT * INTO req FROM friend_requests WHERE id = request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found';
  END IF;
  -- 承認できるのは受信者本人のみ
  IF req."addresseeId" <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE friend_requests SET status = 'accepted' WHERE id = request_id;

  INSERT INTO user_friends ("userId", "friendId")
  VALUES (req."requesterId", req."addresseeId"), (req."addresseeId", req."requesterId")
  ON CONFLICT ("userId", "friendId") DO NOTHING;
END;
$$;

-- ---------- フレンド解除（双方向 user_friends と申請を削除） ----------
CREATE OR REPLACE FUNCTION remove_friend(other_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  DELETE FROM user_friends
  WHERE ("userId" = auth.uid() AND "friendId" = other_id)
     OR ("userId" = other_id AND "friendId" = auth.uid());

  DELETE FROM friend_requests
  WHERE ("requesterId" = auth.uid() AND "addresseeId" = other_id)
     OR ("requesterId" = other_id AND "addresseeId" = auth.uid());
END;
$$;

-- ---------- 30日より古いチームメッセージの削除（pg_cron から実行） ----------
CREATE OR REPLACE FUNCTION delete_old_team_messages()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  DELETE FROM team_messages
  WHERE "createdAt" < now() - interval '30 days';
$$;

-- ---------- 実行権限を authenticated に限定 ----------
REVOKE ALL ON FUNCTION accept_friend_request(uuid) FROM public;
GRANT EXECUTE ON FUNCTION accept_friend_request(uuid) TO authenticated;

REVOKE ALL ON FUNCTION remove_friend(uuid) FROM public;
GRANT EXECUTE ON FUNCTION remove_friend(uuid) TO authenticated;

-- delete_old_team_messages は cron からのみ呼ぶため一般ユーザーには付与しない。
REVOKE ALL ON FUNCTION delete_old_team_messages() FROM public;
