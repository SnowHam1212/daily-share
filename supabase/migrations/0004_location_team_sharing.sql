-- ============================================================
-- Per-team location sharing.
--
-- Adds locations."sharedTeamIds": when sharingState = 'team', the location is
-- visible only to members of the listed teams. An empty list keeps the previous
-- behaviour (shared with every team the owner belongs to), so existing rows are
-- unaffected.
-- ============================================================

ALTER TABLE locations
  ADD COLUMN "sharedTeamIds" uuid[] NOT NULL DEFAULT '{}';

-- Rebuild the SELECT policy so the 'team' case respects sharedTeamIds.
DROP POLICY IF EXISTS "locations_select" ON locations;

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
    -- team: 本人、または「共有先チーム」に所属するメンバー
    --       sharedTeamIds が空の場合は従来どおり所属する全チームへ共有
    ("sharingState" = 'team' AND (
      "userId" = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM   user_teams owner_ut
        JOIN   user_teams viewer_ut ON owner_ut."teamId" = viewer_ut."teamId"
        WHERE  owner_ut."userId"  = locations."userId"
          AND  viewer_ut."userId" = auth.uid()
          AND  (
            cardinality(locations."sharedTeamIds") = 0
            OR owner_ut."teamId" = ANY(locations."sharedTeamIds")
          )
      )
    ))
  );
