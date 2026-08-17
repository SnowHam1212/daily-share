-- ============================================================
-- 0022_revoke_definer_functions_from_public.sql
-- SECURITY DEFINER 関数から PUBLIC 既定の EXECUTE を剥がす（#117 / セキュリティ）
--
-- 症状:
--   PostgreSQL は関数作成時に PUBLIC へ EXECUTE を既定で付与する。
--   `GRANT EXECUTE ... TO authenticated` を書いても既定の PUBLIC 権限は
--   消えないため、明示的に REVOKE しない限り **anon（未ログイン）からも
--   関数本体を実行できる**。
--
--   2026-08-17 に本番へ匿名で確認したところ、以下がすべて関数本体まで
--   到達していた（`42501 permission denied` ではなくアプリ側の P0001 や
--   成功レスポンスが返る）:
--
--     list_team_members / list_team_invitations / list_my_team_invitations
--     invite_team_member / accept_team_invitation / decline_team_invitation
--     cancel_team_invitation / remove_team_member / leave_team
--     accept_friend_request / remove_friend / shares_team_for_location
--
--   正しく塞がっていた（42501 を返した）のは以下だけ:
--     is_team_member / is_team_admin（0012）
--     join_team_by_code（0015）/ create_team（0019）
--     get_public_profiles / search_users / list_my_teammates（0018）
--
-- 根本原因: `FROM public` だけでは足りない
--   0014 は accept_friend_request / remove_friend /
--   delete_old_team_messages に対して
--
--       REVOKE ALL ON FUNCTION ... FROM public;
--
--   を実行している。にもかかわらず、この3つは匿名から実行できた。
--
--   Supabase は `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO
--   anon, authenticated, service_role` を既定で設定しているため、
--   新しく作られた関数には **anon への明示的な GRANT** が付く。
--   PUBLIC 擬似ロールへの既定付与とは別物なので、`FROM public` だけを
--   剥がしても anon の明示 GRANT は残る。
--
--   実際、上で「正しく塞がっていた」関数はすべて `FROM anon, public`
--   （0012 は `FROM authenticated, anon, public`）で剥がしており、
--   `FROM public` だけの 0014 の3関数だけが空いている。観測結果と
--   完全に一致する。**必ず anon を明示して REVOKE すること。**
--
--   別の可能性として「0014 自体が本番に適用されていない」も考えられる
--   （0008 の番号衝突でスキップされた側だった疑い）。どちらであっても
--   本ファイルの REVOKE は正しく、冪等に効く。切り分けたい場合は
--   0014 が設定するはずの search_path が入っているかを見る:
--
--     SELECT proname, proconfig FROM pg_proc p
--     JOIN pg_namespace n ON n.oid = p.pronamespace
--     WHERE n.nspname = 'public' AND proname = 'accept_friend_request';
--     -- proconfig に search_path があれば 0014 は適用済み
--
-- 影響:
--   実データの漏洩・破壊は確認されていない。すべて auth.uid() を見ており、
--   anon では NULL になるため参照系は「メンバーではない」で弾かれ、
--   更新・削除系は NULL 比較で0行にマッチする。
--   つまり**多層防御の欠落**であり、ただちに悪用できる穴ではない。
--   ただし CLAUDE.md が is_team_member について「membership oracle を
--   防ぐため REVOKE 済み。新しい RPC を足すときも GRANT しないこと」と
--   定めている方針が、既存の大半の関数に適用されていない状態だった。
--   今後 auth.uid() のガードが甘い関数を1つ足すだけで未認証から到達する。
--
-- 安全性:
--   剥がすのは anon / public のみで、authenticated への明示 GRANT は
--   触らない。PUBLIC は継承される role ではなく「全員」を表す擬似ロール
--   なので、REVOKE ... FROM public は authenticated の明示 GRANT を
--   打ち消さない。よってログイン済みユーザーの動作は変わらない。
--   0015 / 0018 / 0019 が既に本番で同じ `FROM anon, public` を実行して
--   問題が出ていないことも確認済み。
--
-- 対象外:
--   handle_new_user / enforce_team_message_rate_limit /
--   enforce_friend_request_rate_limit は戻り値が trigger で、PostgREST は
--   trigger を返す関数を公開しないため RPC から到達しない。また
--   PostgreSQL はトリガー起動時に EXECUTE 権限を検査しない。
--   本ファイルでは触らない。
-- ============================================================

-- ---------- 0006: アカウント削除 ----------
REVOKE EXECUTE ON FUNCTION public.delete_own_account()                 FROM anon, public;

-- ---------- 0004: チャットの保持期間（pg_cron から呼ばれる保守用） ----------
-- 匿名から叩けると 30 日より古いメッセージを任意のタイミングで消せてしまう。
REVOKE EXECUTE ON FUNCTION public.delete_old_team_messages()           FROM anon, public;

-- ---------- 0005: フレンド ----------
REVOKE EXECUTE ON FUNCTION public.accept_friend_request(uuid)          FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.remove_friend(uuid)                  FROM anon, public;

-- ---------- 0012: チームメンバー管理 ----------
REVOKE EXECUTE ON FUNCTION public.list_team_members(uuid)              FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.invite_team_member(uuid, uuid)       FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_my_team_invitations()           FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.list_team_invitations(uuid)          FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.accept_team_invitation(uuid)         FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.decline_team_invitation(uuid)        FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.cancel_team_invitation(uuid)         FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.remove_team_member(uuid, uuid)       FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.leave_team(uuid)                     FROM anon, public;

-- ---------- 0019: locations_select のポリシーヘルパ ----------
-- authenticated の EXECUTE は**残すこと**。ポリシー式の評価は問い合わせ
-- ユーザーの権限で行われるため、REVOKE すると locations の SELECT 自体が
-- permission denied になる（0019 に記録あり）。anon から剥がすだけにする。
REVOKE EXECUTE ON FUNCTION public.shares_team_for_location(uuid, uuid[]) FROM anon, public;


-- ============================================================
-- 適用後の確認（0行になること）
--
--   SELECT p.proname
--   FROM   pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE  n.nspname = 'public' AND p.prosecdef
--     AND  has_function_privilege('anon', p.oid, 'EXECUTE')
--   ORDER  BY p.proname;
--
-- 併せて、ログイン済みで以下が従来どおり動くことを確認する:
--   チームのメンバー一覧 / 招待の送受信 / 退出 / フレンド承認・解除 /
--   地図のチームメイトのピン表示（shares_team_for_location を使う）
-- ============================================================
