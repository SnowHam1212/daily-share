-- ============================================================
-- 0001_init.sql
-- ============================================================


-- ============================================================
-- SECTION 1: CLEANUP（再実行対応）
-- ============================================================

DROP TABLE IF EXISTS locations    CASCADE;
DROP TABLE IF EXISTS events       CASCADE;
DROP TABLE IF EXISTS user_friends CASCADE;
DROP TABLE IF EXISTS user_teams   CASCADE;
DROP TABLE IF EXISTS teams        CASCADE;
DROP TABLE IF EXISTS users        CASCADE;
DROP TYPE  IF EXISTS sharing_state;


-- ============================================================
-- SECTION 2: ENUM
-- ============================================================

CREATE TYPE sharing_state AS ENUM ('private', 'friends', 'team');


-- ============================================================
-- SECTION 3: TABLES
-- ============================================================

-- users
-- id は auth.users.id と一致させる（DEFAULT は使わず INSERT 時に auth.uid() を渡す）
CREATE TABLE users (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  "displayName" text        NOT NULL,
  "familyName"  text,
  "firstName"   text,
  email         text        UNIQUE NOT NULL,
  "phoneNumber" text,
  birthday      date,
  "createdAt"   timestamptz DEFAULT now()
);

-- teams
CREATE TABLE teams (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamName"         text        NOT NULL,
  "invitationalCode" text        UNIQUE NOT NULL,
  "createdAt"        timestamptz DEFAULT now()
);

-- user_teams
CREATE TABLE user_teams (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"   uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "teamId"   uuid        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role       text        NOT NULL DEFAULT 'member', -- 'admin' | 'member'
  "joinedAt" timestamptz DEFAULT now(),
  UNIQUE ("userId", "teamId")
);

-- user_friends
CREATE TABLE user_friends (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "friendId"  uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "createdAt" timestamptz DEFAULT now(),
  UNIQUE ("userId", "friendId"),
  CHECK ("userId" <> "friendId")
);

-- events
CREATE TABLE events (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  "createdBy"     uuid          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "teamId"        uuid          NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name            text          NOT NULL,
  "startAt"       timestamptz   NOT NULL,
  "endAt"         timestamptz   NOT NULL,
  "eventLocation" text,
  "sharingState"  sharing_state NOT NULL DEFAULT 'team',
  "createdAt"     timestamptz   DEFAULT now(),
  CHECK ("startAt" < "endAt")
);

-- locations
CREATE TABLE locations (
  "userId"       uuid          PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  lat            float8,
  lng            float8,
  "sharingState" sharing_state NOT NULL DEFAULT 'private',
  "updatedAt"    timestamptz   DEFAULT now()
);


-- ============================================================
-- SECTION 4: INDEXES
-- ============================================================

CREATE INDEX idx_user_teams_user_id   ON user_teams   ("userId");
CREATE INDEX idx_user_teams_team_id   ON user_teams   ("teamId");
CREATE INDEX idx_user_friends_user_id ON user_friends ("userId");
CREATE INDEX idx_user_friends_friend  ON user_friends ("friendId");
CREATE INDEX idx_events_team_id       ON events       ("teamId");
CREATE INDEX idx_events_created_by    ON events       ("createdBy");
CREATE INDEX idx_locations_user_id    ON locations    ("userId");


-- ============================================================
-- SECTION 5: REALTIME
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE locations;


-- ============================================================
-- SECTION 6: ROW LEVEL SECURITY
-- ============================================================

-- ---------- users ----------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select" ON users
  FOR SELECT USING (true);

CREATE POLICY "users_update" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "users_delete" ON users
  FOR DELETE USING (auth.uid() = id);

-- INSERT は Supabase Auth トリガー or クライアントが自分の id で行う
CREATE POLICY "users_insert" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);


-- ---------- teams ----------
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_select" ON teams
  FOR SELECT USING (
    id IN (
      SELECT "teamId" FROM user_teams WHERE "userId" = auth.uid()
    )
  );

-- チーム作成は誰でも可（作成後に user_teams へ自分を admin として追加する）
CREATE POLICY "teams_insert" ON teams
  FOR INSERT WITH CHECK (true);


-- ---------- user_teams ----------
ALTER TABLE user_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_teams_select" ON user_teams
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "user_teams_insert" ON user_teams
  FOR INSERT WITH CHECK ("userId" = auth.uid());

CREATE POLICY "user_teams_delete" ON user_teams
  FOR DELETE USING ("userId" = auth.uid());


-- ---------- user_friends ----------
ALTER TABLE user_friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_friends_select" ON user_friends
  FOR SELECT USING ("userId" = auth.uid());

CREATE POLICY "user_friends_insert" ON user_friends
  FOR INSERT WITH CHECK ("userId" = auth.uid());

CREATE POLICY "user_friends_delete" ON user_friends
  FOR DELETE USING ("userId" = auth.uid());


-- ---------- events ----------
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select" ON events
  FOR SELECT USING (
    "teamId" IN (
      SELECT "teamId" FROM user_teams WHERE "userId" = auth.uid()
    )
  );

CREATE POLICY "events_insert" ON events
  FOR INSERT WITH CHECK ("createdBy" = auth.uid());

CREATE POLICY "events_update" ON events
  FOR UPDATE USING ("createdBy" = auth.uid());

CREATE POLICY "events_delete" ON events
  FOR DELETE USING ("createdBy" = auth.uid());


-- ---------- locations ----------
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "locations_select" ON locations
  FOR SELECT USING (
    -- private: 本人のみ
    ("sharingState" = 'private' AND "userId" = auth.uid())
    OR
    -- friends: 自分、または自分を friendId に持つ友達関係があるユーザー
    ("sharingState" = 'friends' AND (
      "userId" = auth.uid()
      OR "userId" IN (
        SELECT "friendId" FROM user_friends WHERE "userId" = auth.uid()
      )
    ))
    OR
    -- team: 自分、または同じチームに所属するメンバー
    ("sharingState" = 'team' AND (
      "userId" = auth.uid()
      OR "userId" IN (
        SELECT ut2."userId"
        FROM   user_teams ut1
        JOIN   user_teams ut2 ON ut1."teamId" = ut2."teamId"
        WHERE  ut1."userId" = auth.uid()
      )
    ))
  );

CREATE POLICY "locations_insert" ON locations
  FOR INSERT WITH CHECK ("userId" = auth.uid());

CREATE POLICY "locations_update" ON locations
  FOR UPDATE USING ("userId" = auth.uid());
