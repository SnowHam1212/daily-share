import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface TeamMember {
  userId: string
  displayName: string
  role: string
  joinedAt: string | null
}

export interface PendingInvitation {
  invitationId: string
  inviteeId: string
  inviteeName: string
  createdAt: string | null
}

type Result = { error: string | null }

/**
 * トークルーム（＝チーム）のメンバー管理。user_teams の RLS は自分の行しか
 * 参照・変更できないため、一覧・招待・追放・退出はすべて SECURITY DEFINER の
 * RPC（0012 マイグレーション）経由で行う。
 *
 * 追加は「招待 → 本人が承諾」の2段階。invite しても user_teams には入らない。
 */
export function useTeamMembers(teamId: string | null) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!teamId) {
      setMembers([])
      setInvitations([])
      return
    }
    setLoading(true)
    try {
      const [memberRes, inviteRes] = await Promise.all([
        supabase.rpc('list_team_members', { p_team_id: teamId }),
        supabase.rpc('list_team_invitations', { p_team_id: teamId }),
      ])

      if (memberRes.error) {
        console.error('list_team_members error', memberRes.error)
        setMembers([])
      } else {
        setMembers(
          (memberRes.data ?? []).map((r) => ({
            userId: r.user_id,
            displayName: r.display_name,
            role: r.role,
            joinedAt: r.joined_at,
          })),
        )
      }

      if (inviteRes.error) {
        console.error('list_team_invitations error', inviteRes.error)
        setInvitations([])
      } else {
        setInvitations(
          (inviteRes.data ?? []).map((r) => ({
            invitationId: r.invitation_id,
            inviteeId: r.invitee_id,
            inviteeName: r.invitee_name,
            createdAt: r.created_at,
          })),
        )
      }
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const inviteMember = useCallback(
    async (userId: string): Promise<Result> => {
      if (!teamId) return { error: 'ルームが選択されていません' }
      const { error } = await supabase.rpc('invite_team_member', {
        p_team_id: teamId,
        p_user_id: userId,
      })
      if (error) return { error: error.message }
      await refresh()
      return { error: null }
    },
    [teamId, refresh],
  )

  const cancelInvitation = useCallback(
    async (invitationId: string): Promise<Result> => {
      const { error } = await supabase.rpc('cancel_team_invitation', {
        p_invitation_id: invitationId,
      })
      if (error) return { error: error.message }
      await refresh()
      return { error: null }
    },
    [refresh],
  )

  const removeMember = useCallback(
    async (userId: string): Promise<Result> => {
      if (!teamId) return { error: 'ルームが選択されていません' }
      const { error } = await supabase.rpc('remove_team_member', {
        p_team_id: teamId,
        p_user_id: userId,
      })
      if (error) return { error: error.message }
      await refresh()
      return { error: null }
    },
    [teamId, refresh],
  )

  const leaveTeam = useCallback(async (): Promise<Result> => {
    if (!teamId) return { error: 'ルームが選択されていません' }
    const { error } = await supabase.rpc('leave_team', { p_team_id: teamId })
    if (error) return { error: error.message }
    return { error: null }
  }, [teamId])

  return {
    members,
    invitations,
    loading,
    refresh,
    inviteMember,
    cancelInvitation,
    removeMember,
    leaveTeam,
  }
}
