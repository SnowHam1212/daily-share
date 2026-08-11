import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface MyTeamInvitation {
  invitationId: string
  teamId: string
  teamName: string
  inviterId: string
  inviterName: string
  createdAt: string | null
}

type Result = { error: string | null }

/**
 * 自分宛に届いている未処理のチーム招待。
 * 承諾するまで user_teams には入らない（0012 マイグレーション）。
 */
export function useMyTeamInvitations() {
  const [invitations, setInvitations] = useState<MyTeamInvitation[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('list_my_team_invitations')
      if (error) {
        console.error('list_my_team_invitations error', error)
        setInvitations([])
        return
      }
      setInvitations(
        (data ?? []).map((r) => ({
          invitationId: r.invitation_id,
          teamId: r.team_id,
          teamName: r.team_name,
          inviterId: r.inviter_id,
          inviterName: r.inviter_name,
          createdAt: r.created_at,
        })),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const accept = useCallback(
    async (invitationId: string): Promise<Result> => {
      const { error } = await supabase.rpc('accept_team_invitation', {
        p_invitation_id: invitationId,
      })
      if (error) return { error: error.message }
      await refresh()
      return { error: null }
    },
    [refresh],
  )

  const decline = useCallback(
    async (invitationId: string): Promise<Result> => {
      const { error } = await supabase.rpc('decline_team_invitation', {
        p_invitation_id: invitationId,
      })
      if (error) return { error: error.message }
      await refresh()
      return { error: null }
    },
    [refresh],
  )

  return { invitations, loading, refresh, accept, decline }
}
