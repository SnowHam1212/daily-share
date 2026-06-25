-- ============================================================
-- 0004_team_messages_retention.sql
-- チームチャットの保持期間（30日）と自動削除
-- ============================================================

-- ----------------------------------------------------------
-- 30日より古いメッセージを削除する関数
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_old_team_messages()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM team_messages
  WHERE "createdAt" < now() - interval '30 days';
$$;

-- ----------------------------------------------------------
-- pg_cron で毎日 03:00(UTC) に実行
-- ----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 既存の同名ジョブがあれば貼り直す（再実行対応）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delete-old-team-messages') THEN
    PERFORM cron.unschedule('delete-old-team-messages');
  END IF;
END $$;

SELECT cron.schedule(
  'delete-old-team-messages',
  '0 3 * * *',
  $$ SELECT delete_old_team_messages(); $$
);
