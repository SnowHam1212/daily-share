-- ============================================================
-- 0010_rate_limiting.sql
-- 濫用対策: フレンド申請・チームメッセージのレート制限（DB トリガー）
--
-- BEFORE INSERT トリガーで、直近の一定時間に同一ユーザーが作成した行数を数え、
-- 上限を超える場合は例外を投げて挿入を拒否する。
-- 正確にカウントするため SECURITY DEFINER（RLS の影響を受けない）+ search_path 固定。
-- ============================================================

-- ---------- チームメッセージ: 10秒で10件まで ----------
CREATE OR REPLACE FUNCTION enforce_team_message_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  recent integer;
BEGIN
  SELECT count(*) INTO recent
  FROM team_messages
  WHERE "userId" = NEW."userId"
    AND "createdAt" > now() - interval '10 seconds';

  IF recent >= 10 THEN
    RAISE EXCEPTION 'メッセージの送信が多すぎます。少し時間をおいてからお試しください。'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_message_rate_limit ON team_messages;
CREATE TRIGGER trg_team_message_rate_limit
  BEFORE INSERT ON team_messages
  FOR EACH ROW EXECUTE FUNCTION enforce_team_message_rate_limit();

-- ---------- フレンド申請: 1分で10件 / 1時間で30件まで ----------
CREATE OR REPLACE FUNCTION enforce_friend_request_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  per_minute integer;
  per_hour integer;
BEGIN
  SELECT count(*) INTO per_minute
  FROM friend_requests
  WHERE "requesterId" = NEW."requesterId"
    AND "createdAt" > now() - interval '1 minute';

  IF per_minute >= 10 THEN
    RAISE EXCEPTION 'フレンド申請が多すぎます。少し時間をおいてからお試しください。'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO per_hour
  FROM friend_requests
  WHERE "requesterId" = NEW."requesterId"
    AND "createdAt" > now() - interval '1 hour';

  IF per_hour >= 30 THEN
    RAISE EXCEPTION '1時間あたりのフレンド申請の上限に達しました。時間をおいてからお試しください。'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_friend_request_rate_limit ON friend_requests;
CREATE TRIGGER trg_friend_request_rate_limit
  BEFORE INSERT ON friend_requests
  FOR EACH ROW EXECUTE FUNCTION enforce_friend_request_rate_limit();

-- トリガー関数は直接呼び出させない
REVOKE ALL ON FUNCTION enforce_team_message_rate_limit() FROM public;
REVOKE ALL ON FUNCTION enforce_friend_request_rate_limit() FROM public;
