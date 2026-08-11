-- ============================================================
-- 0012_team_member_management.sql
-- チームを「トークルーム」として扱うためのメンバー管理。
--
-- user_teams の RLS は「自分の行のみ」参照・変更可（0001）なので、
-- メンバー一覧・招待・削除は呼び出し元の権限を検証する
-- SECURITY DEFINER 関数として提供する。
--
-- 権限方針:
--   * 追加は「招待 → 本人が承諾」の2段階。0005 のフレンド申請と同じ形。
--     他人を勝手にチームへ入れることはできない（位置情報・予定を共有する
--     アプリなので、参加は必ず本人の同意を要件とする）。
--   * 招待コード（0007 join_team_by_code）による参加は本人が自分で
--     コードを入力する操作なので、同意済みとみなし即参加のまま。
--   * 追放できる人はチーム作成時に teams."removalPolicy" で決める。
-- ============================================================


-- ============================================================
-- SECTION 1: teams."removalPolicy"
-- ============================================================

-- 'admin_only' : 管理者のみが他メンバーを追放できる（既定）
-- 'anyone'     : メンバーなら誰でも追放できる
-- 'nobody'     : 誰も追放できない（各自の退出のみ）
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS "removalPolicy" text NOT NULL DEFAULT 'admin_only';

DO $$
BEGIN
  ALTER TABLE teams ADD CONSTRAINT teams_removal_policy_check
    CHECK ("removalPolicy" IN ('admin_only', 'anyone', 'nobody'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

-- NOTE: 方針はチーム作成時の INSERT で決める（teams_insert は WITH CHECK (true)）。
-- あとから変更する導線は用意しないため、teams への UPDATE ポリシーは足さない。
-- 変更できるようにする場合は、管理者に限定した UPDATE ポリシーをここに追加する。


-- ============================================================
-- SECTION 2: team_invitations
-- ============================================================

CREATE TABLE IF NOT EXISTS team_invitations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamId"    uuid        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  "inviterId" uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "inviteeId" uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'pending', -- 'pending' | 'accepted' | 'declined'
  "createdAt" timestamptz DEFAULT now(),
  UNIQUE ("teamId", "inviteeId"),
  CHECK (status IN ('pending', 'accepted', 'declined'))
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_invitee ON team_invitations ("inviteeId", status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_team    ON team_invitations ("teamId", status);

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- 自分宛の招待だけ直接 SELECT できる。
-- チーム側から見た招待一覧は list_team_invitations（DEFINER）経由。
DROP POLICY IF EXISTS "team_invitations_select" ON team_invitations;
CREATE POLICY "team_invitations_select" ON team_invitations
  FOR SELECT USING ("inviteeId" = auth.uid());

-- INSERT / UPDATE / DELETE はすべて RPC 経由（DEFINER）で行うため
-- クライアントに直接の書き込み権限は与えない。


-- ============================================================
-- SECTION 3: ヘルパ
-- ============================================================

-- 呼び出し元がチームのメンバーかを判定する内部ヘルパ。
-- NOTE: authenticated には GRANT しない。GRANT すると
--       「任意のユーザーが任意のチームに所属しているか」を
--       総当たりで調べられる membership oracle になるため。
--       利用側の関数はすべて SECURITY DEFINER なので GRANT は不要。
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_teams
    WHERE "teamId" = p_team_id AND "userId" = p_user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM authenticated, anon, public;

CREATE OR REPLACE FUNCTION public.is_team_admin(p_team_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_teams
    WHERE "teamId" = p_team_id AND "userId" = p_user_id AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_team_admin(uuid, uuid) FROM authenticated, anon, public;


-- ============================================================
-- SECTION 4: メンバー一覧
-- ============================================================

CREATE OR REPLACE FUNCTION public.list_team_members(p_team_id uuid)
RETURNS TABLE (user_id uuid, display_name text, role text, joined_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_team_member(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a team member';
  END IF;

  RETURN QUERY
    SELECT ut."userId", u."displayName", ut.role, ut."joinedAt"
    FROM user_teams ut
    JOIN users u ON u.id = ut."userId"
    WHERE ut."teamId" = p_team_id
    ORDER BY ut."joinedAt";
END;
$$;


-- ============================================================
-- SECTION 5: 招待
-- ============================================================

-- 招待を出す。メンバーなら誰でも招待できるが、参加は相手の承諾が要る。
CREATE OR REPLACE FUNCTION public.invite_team_member(p_team_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_team_member(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a team member';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot invite yourself';
  END IF;

  IF public.is_team_member(p_team_id, p_user_id) THEN
    RAISE EXCEPTION 'already a member';
  END IF;

  -- 一度断られていても再招待できるよう pending に戻す。
  INSERT INTO team_invitations ("teamId", "inviterId", "inviteeId", status)
  VALUES (p_team_id, auth.uid(), p_user_id, 'pending')
  ON CONFLICT ("teamId", "inviteeId") DO UPDATE
    SET status      = 'pending',
        "inviterId" = auth.uid(),
        "createdAt" = now();
END;
$$;

-- 自分宛の未処理の招待一覧（チーム名・招待者名つき）。
CREATE OR REPLACE FUNCTION public.list_my_team_invitations()
RETURNS TABLE (
  invitation_id uuid,
  team_id       uuid,
  team_name     text,
  inviter_id    uuid,
  inviter_name  text,
  created_at    timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT ti.id, ti."teamId", t."teamName", ti."inviterId", u."displayName", ti."createdAt"
  FROM team_invitations ti
  JOIN teams t ON t.id = ti."teamId"
  JOIN users u ON u.id = ti."inviterId"
  WHERE ti."inviteeId" = auth.uid() AND ti.status = 'pending'
  ORDER BY ti."createdAt" DESC;
$$;

-- チーム側から見た未処理の招待一覧（重複招待を UI で防ぐため）。
CREATE OR REPLACE FUNCTION public.list_team_invitations(p_team_id uuid)
RETURNS TABLE (invitation_id uuid, invitee_id uuid, invitee_name text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public.is_team_member(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a team member';
  END IF;

  RETURN QUERY
    SELECT ti.id, ti."inviteeId", u."displayName", ti."createdAt"
    FROM team_invitations ti
    JOIN users u ON u.id = ti."inviteeId"
    WHERE ti."teamId" = p_team_id AND ti.status = 'pending'
    ORDER BY ti."createdAt";
END;
$$;

-- 承諾。招待された本人のみ。ここで初めて user_teams に行が入る。
CREATE OR REPLACE FUNCTION public.accept_team_invitation(p_invitation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv team_invitations%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM team_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found';
  END IF;

  IF inv."inviteeId" <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF inv.status <> 'pending' THEN
    RAISE EXCEPTION 'invitation already handled';
  END IF;

  UPDATE team_invitations SET status = 'accepted' WHERE id = p_invitation_id;

  INSERT INTO user_teams ("userId", "teamId", role)
  VALUES (inv."inviteeId", inv."teamId", 'member')
  ON CONFLICT ("userId", "teamId") DO NOTHING;

  RETURN inv."teamId";
END;
$$;

-- 拒否。招待された本人のみ。行は残さず消して再招待できるようにする。
CREATE OR REPLACE FUNCTION public.decline_team_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv team_invitations%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM team_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation not found';
  END IF;

  IF inv."inviteeId" <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  DELETE FROM team_invitations WHERE id = p_invitation_id;
END;
$$;

-- 招待の取り消し。チームのメンバーなら取り消せる。
CREATE OR REPLACE FUNCTION public.cancel_team_invitation(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv team_invitations%ROWTYPE;
BEGIN
  SELECT * INTO inv FROM team_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF NOT public.is_team_member(inv."teamId", auth.uid()) THEN
    RAISE EXCEPTION 'not a team member';
  END IF;

  DELETE FROM team_invitations WHERE id = p_invitation_id;
END;
$$;


-- ============================================================
-- SECTION 6: 追放・退出
-- ============================================================

-- 他メンバーの追放。teams."removalPolicy" に従う。
-- 自分自身の退出には leave_team を使うこと。
CREATE OR REPLACE FUNCTION public.remove_team_member(p_team_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy       text;
  v_target_role  text;
BEGIN
  IF NOT public.is_team_member(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a team member';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'use leave_team to leave a team';
  END IF;

  SELECT "removalPolicy" INTO v_policy FROM teams WHERE id = p_team_id;

  IF v_policy = 'nobody' THEN
    RAISE EXCEPTION 'このルームではメンバーを退出させられません';
  END IF;

  IF v_policy = 'admin_only' AND NOT public.is_team_admin(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION '管理者のみメンバーを退出させられます';
  END IF;

  SELECT role INTO v_target_role
  FROM user_teams WHERE "teamId" = p_team_id AND "userId" = p_user_id;

  IF NOT FOUND THEN
    RETURN; -- すでにメンバーではない
  END IF;

  -- 'anyone' でも管理者は一般メンバーから守る。
  IF v_target_role = 'admin' AND NOT public.is_team_admin(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION '管理者を退出させられるのは管理者だけです';
  END IF;

  DELETE FROM user_teams
  WHERE "teamId" = p_team_id AND "userId" = p_user_id;

  -- 追放された相手が再度参加できるよう、過去の招待記録を消す。
  DELETE FROM team_invitations
  WHERE "teamId" = p_team_id AND "inviteeId" = p_user_id;
END;
$$;

-- 自分がチームを抜ける。
-- 最後の1人が抜けるとメッセージだけ残った孤児チームになるため、
-- チームごと削除する（events / team_messages は ON DELETE CASCADE）。
-- 最後の管理者が抜ける場合は、残りの最古参メンバーを管理者に繰り上げる。
CREATE OR REPLACE FUNCTION public.leave_team(p_team_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_admin     boolean;
  v_remaining     integer;
  v_admins_left   integer;
  v_successor     uuid;
BEGIN
  IF NOT public.is_team_member(p_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'not a team member';
  END IF;

  v_was_admin := public.is_team_admin(p_team_id, auth.uid());

  DELETE FROM user_teams
  WHERE "teamId" = p_team_id AND "userId" = auth.uid();

  SELECT count(*) INTO v_remaining FROM user_teams WHERE "teamId" = p_team_id;

  IF v_remaining = 0 THEN
    DELETE FROM teams WHERE id = p_team_id;
    RETURN;
  END IF;

  IF v_was_admin THEN
    SELECT count(*) INTO v_admins_left
    FROM user_teams WHERE "teamId" = p_team_id AND role = 'admin';

    IF v_admins_left = 0 THEN
      SELECT "userId" INTO v_successor
      FROM user_teams WHERE "teamId" = p_team_id
      ORDER BY "joinedAt" LIMIT 1;

      UPDATE user_teams SET role = 'admin'
      WHERE "teamId" = p_team_id AND "userId" = v_successor;
    END IF;
  END IF;
END;
$$;


-- ============================================================
-- SECTION 7: GRANT
-- ============================================================

GRANT EXECUTE ON FUNCTION public.list_team_members(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_team_member(uuid, uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_team_invitations()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_team_invitations(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_team_invitation(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_team_invitation(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid, uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_team(uuid)                 TO authenticated;

-- 旧版（0012 初稿）で作られた無条件追加関数が残っていれば落とす。
DROP FUNCTION IF EXISTS public.add_team_member(uuid, uuid);
