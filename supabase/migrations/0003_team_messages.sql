-- ============================================================
-- 0003_team_messages.sql
-- チーム内チャット（team_messages）
-- ============================================================

-- ----------------------------------------------------------
-- TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamId"    uuid        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  "userId"    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  "createdAt" timestamptz DEFAULT now()
);

-- ----------------------------------------------------------
-- INDEXES
-- ----------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_team_messages_team_id ON team_messages ("teamId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_team_messages_user_id ON team_messages ("userId");

-- ----------------------------------------------------------
-- REALTIME
-- ----------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE team_messages;

-- ----------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------
ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;

-- 所属チームのメッセージのみ閲覧可
CREATE POLICY "team_messages_select" ON team_messages
  FOR SELECT USING (
    "teamId" IN (
      SELECT "teamId" FROM user_teams WHERE "userId" = auth.uid()
    )
  );

-- 自分の投稿のみ、かつ所属チームへのみ送信可
CREATE POLICY "team_messages_insert" ON team_messages
  FOR INSERT WITH CHECK (
    "userId" = auth.uid()
    AND "teamId" IN (
      SELECT "teamId" FROM user_teams WHERE "userId" = auth.uid()
    )
  );

-- 自分の投稿のみ削除可
CREATE POLICY "team_messages_delete" ON team_messages
  FOR DELETE USING ("userId" = auth.uid());
