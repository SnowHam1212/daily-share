-- ============================================================
-- 0005_friend_requests.sql
-- フレンド申請 / 承認 と、双方向フレンド関係の確立
-- ============================================================

-- ----------------------------------------------------------
-- TABLE: friend_requests
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS friend_requests (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "requesterId" uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "addresseeId" uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'declined'
  "createdAt"   timestamptz DEFAULT now(),
  UNIQUE ("requesterId", "addresseeId"),
  CHECK ("requesterId" <> "addresseeId")
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_addressee ON friend_requests ("addresseeId", status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_requester ON friend_requests ("requesterId", status);

-- ----------------------------------------------------------
-- RLS: friend_requests
-- ----------------------------------------------------------
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- 自分が関与する申請のみ閲覧
CREATE POLICY "friend_requests_select" ON friend_requests
  FOR SELECT USING (
    "requesterId" = auth.uid() OR "addresseeId" = auth.uid()
  );

-- 自分からの申請のみ作成
CREATE POLICY "friend_requests_insert" ON friend_requests
  FOR INSERT WITH CHECK ("requesterId" = auth.uid());

-- 受信者が承認/拒否（更新）できる
CREATE POLICY "friend_requests_update" ON friend_requests
  FOR UPDATE USING ("addresseeId" = auth.uid());

-- 当事者は取り消し/削除できる
CREATE POLICY "friend_requests_delete" ON friend_requests
  FOR DELETE USING (
    "requesterId" = auth.uid() OR "addresseeId" = auth.uid()
  );

-- ----------------------------------------------------------
-- RPC: 申請を承認し、双方向の user_friends 行を作る
--   user_friends の INSERT は RLS で「自分の userId のみ」に限定されるため、
--   反対方向の行は SECURITY DEFINER 関数で安全に挿入する。
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION accept_friend_request(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- ----------------------------------------------------------
-- RPC: フレンド解除（双方向の user_friends 行を削除）
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION remove_friend(other_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM user_friends
  WHERE ("userId" = auth.uid() AND "friendId" = other_id)
     OR ("userId" = other_id AND "friendId" = auth.uid());

  -- 過去の申請も消して再申請できるようにする
  DELETE FROM friend_requests
  WHERE ("requesterId" = auth.uid() AND "addresseeId" = other_id)
     OR ("requesterId" = other_id AND "addresseeId" = auth.uid());
END;
$$;
