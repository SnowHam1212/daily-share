-- ============================================================
-- 0026_direct_messages.sql
-- フレンドと1対1でやり取りする（#99 DM）
--
-- 方針: 専用テーブルを作る（issue の案 A）。
--
-- なぜ「2人だけのチーム」（案 B）にしないのか:
--   1. **位置情報が漏れる。** locations_select は共有範囲が 'team' のとき
--      shares_team_for_location() で「所有者と閲覧者が同じチームに属するか」
--      だけを見る（0019）。DM をチームで表すと DM 相手が自動的に
--      「同じチームのメンバー」になり、共有範囲を 'team' にしている
--      ユーザーは過去に DM した全員へ現在地を晒すことになる。
--   2. **招待コードが必ず発行される。** teams."invitationalCode" は
--      UNIQUE NOT NULL なので、DM をチームで作ると join_team_by_code で
--      第三者が DM に参加できてしまう。
--   3. 塞ぐには join_team_by_code / invite_team_member / leave_team /
--      remove_team_member / shares_team_for_location など**10箇所の RPC**に
--      漏れなくガードを入れる必要があり、1つ忘れるとプライバシー事故になる。
--
--   専用テーブルなら RLS は他テーブルを参照せず自己完結する。
--
-- 仕様（2026-08-26 に決定）:
--   - 受信設定を users."dmPolicy"（enum dm_policy）に持つ。既定は 'friends'
--       'friends'  … フレンドからのみ受け取る（既定）
--       'everyone' … 誰からでも受け取る
--       'off'      … 誰からも受け取らない
--   - 30日で自動削除（team_messages と揃える）
--   - **フレンド解除後は送信不可・過去ログは閲覧可**（Instagram と同じ挙動）
--     SELECT はフレンド関係を見ないので、過去ログは自動的に残る。
--     送信可否だけが can_send_dm() で判定される。
-- ============================================================


-- ---------- 受信設定 ----------
--
-- text + CHECK ではなく **enum** にする。sharing_state（0001）と同じ方針。
-- `supabase gen types` は CHECK 制約の中身を読まないため、text 列だと
-- 生成される TypeScript の型が `string` になり、'freinds' のような
-- 打ち間違いをコンパイラが検出できなくなる。enum なら
-- `'friends' | 'everyone' | 'off'` の union として生成される。
--
-- 値の追加は ALTER TYPE ... ADD VALUE で可能（ただしトランザクション内では
-- 実行できない場合があるため、増やすときは単独のマイグレーションにする）。

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dm_policy') THEN
    CREATE TYPE dm_policy AS ENUM ('friends', 'everyone', 'off');
  END IF;
END $$;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "dmPolicy" dm_policy NOT NULL DEFAULT 'friends';


-- ---------- 送信可否の判定 ----------
--
-- users_select は 0018 以降 `id = auth.uid()` で、**自分の行しか読めない**。
-- 相手の "dmPolicy" と相手のフレンド一覧を見る必要があるため、
-- SECURITY DEFINER で RLS を迂回して真偽値だけを返す
-- （shares_team_for_location と同じ方式）。
--
-- 返すのは「あなたはこの人に送れるか」だけで、相手の設定値そのものや
-- フレンド一覧は返さない。
CREATE OR REPLACE FUNCTION public.can_send_dm(p_recipient uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
  SELECT CASE (SELECT "dmPolicy" FROM users WHERE id = p_recipient)
    WHEN 'everyone' THEN auth.uid() IS NOT NULL
    WHEN 'friends'  THEN EXISTS (
      -- 相手のフレンド一覧に自分が入っているか。user_friends は双方向に
      -- 行を持つ（0005）ので、解除されれば両方の行が消える。
      SELECT 1 FROM user_friends
      WHERE "userId" = p_recipient AND "friendId" = auth.uid()
    )
    ELSE false  -- 'off'、および相手が存在しない場合
  END;
$$;

-- NOTE: direct_messages_insert のポリシー式から評価されるため、
--       authenticated の EXECUTE は**残すこと**。剥がすと DM の INSERT が
--       permission denied になる（0019 の shares_team_for_location と同じ）。
GRANT  EXECUTE ON FUNCTION public.can_send_dm(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_send_dm(uuid) FROM anon, public;


-- ---------- 本体 ----------

CREATE TABLE IF NOT EXISTS direct_messages (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "senderId"    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "recipientId" uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body          text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  "createdAt"   timestamptz DEFAULT now(),
  CHECK ("senderId" <> "recipientId")
);

-- 会話（相手ごと）を新しい順に引くための索引。送受信どちらの向きも辿る。
CREATE INDEX IF NOT EXISTS idx_dm_sender_recipient
  ON direct_messages ("senderId", "recipientId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_dm_recipient_sender
  ON direct_messages ("recipientId", "senderId", "createdAt" DESC);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- 当事者だけが読める。**フレンド関係を見ない**ので、解除後も過去ログは残る。
CREATE POLICY "direct_messages_select" ON direct_messages
  FOR SELECT USING (
    "senderId" = auth.uid() OR "recipientId" = auth.uid()
  );

-- 送信は「自分が送信者」かつ「相手の受信設定が許している」場合のみ。
CREATE POLICY "direct_messages_insert" ON direct_messages
  FOR INSERT WITH CHECK (
    "senderId" = auth.uid()
    AND "recipientId" <> auth.uid()
    AND public.can_send_dm("recipientId")
  );

-- 自分が送ったものだけ削除できる（team_messages_delete と揃える）。
CREATE POLICY "direct_messages_delete" ON direct_messages
  FOR DELETE USING ("senderId" = auth.uid());

-- UPDATE ポリシーは作らない（メッセージは不変）。


-- ---------- レート制限（0010 と同じ方式・同じ閾値） ----------

CREATE OR REPLACE FUNCTION enforce_direct_message_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  recent integer;
BEGIN
  SELECT count(*) INTO recent
  FROM direct_messages
  WHERE "senderId" = NEW."senderId"
    AND "createdAt" > now() - interval '10 seconds';
  IF recent >= 10 THEN
    RAISE EXCEPTION 'メッセージの送信が多すぎます。少し時間をおいてからお試しください。'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_direct_message_rate_limit ON direct_messages;
CREATE TRIGGER trg_direct_message_rate_limit
  BEFORE INSERT ON direct_messages
  FOR EACH ROW EXECUTE FUNCTION enforce_direct_message_rate_limit();


-- ---------- 30日で自動削除（0004 と同じ方式） ----------

CREATE OR REPLACE FUNCTION delete_old_direct_messages()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  DELETE FROM direct_messages
  WHERE "createdAt" < now() - interval '30 days';
$$;

-- cron からのみ呼ぶ。一般ユーザーには実行させない。
REVOKE EXECUTE ON FUNCTION public.delete_old_direct_messages() FROM anon, public;

-- 0004 で導入済みだが、単体で再実行しても通るようにしておく。
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'delete-old-direct-messages') THEN
    PERFORM cron.unschedule('delete-old-direct-messages');
  END IF;
END $$;

-- チームメッセージの削除（03:00）とずらして 03:10 に実行する。
SELECT cron.schedule(
  'delete-old-direct-messages',
  '10 3 * * *',
  $$ SELECT delete_old_direct_messages(); $$
);


-- ---------- Realtime ----------
-- team_messages と同様に新着を購読できるようにする。
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'direct_messages'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
  END IF;
END $$;
