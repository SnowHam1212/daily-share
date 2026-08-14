import { useEffect, useRef } from 'react'
import { useToast } from '@chakra-ui/react'
import { supabase } from '../lib/supabase'
import { PENDING_INVITE_KEY, parseInviteCode } from '../lib/inviteLink'

/**
 * 招待リンク（/join/:code）で来た人を、認証後に自動でチームへ参加させる。
 *
 * 2段階に分かれている:
 *   1. capturePendingInvite() … 描画前に URL からコードを退避し、URL を戻す
 *   2. useRedeemPendingInvite() … 認証後に退避したコードで参加する
 *
 * sessionStorage を挟むのは、Google ログインがリダイレクトで往復して
 * URL のパスを失うため。signInWithOAuth は redirectTo を渡しておらず、
 * 認証後は Supabase の Site URL（＝ルート）に戻ってくる。
 * sessionStorage なら同一タブ・同一オリジンで保持されるので越えられる。
 */

/**
 * URL から招待コードを取り出して退避し、URL をルートに戻す。
 *
 * React の描画前（main.tsx）に一度だけ呼ぶ。描画後だと、認証状態に
 * よってはリダイレクトが走ってコードを取り逃す可能性がある。
 */
export function capturePendingInvite() {
  if (typeof window === 'undefined') return

  const { pathname } = window.location
  // 壊れたリンクを踏んだ場合もアドレスバーは掃除する。
  // アプリ自体は開けるので、変な URL を残さない方が親切。
  const isJoinPath = pathname.toLowerCase().startsWith('/join/')
  if (!isJoinPath) return

  const code = parseInviteCode(pathname)
  if (code) {
    try {
      window.sessionStorage.setItem(PENDING_INVITE_KEY, code)
    } catch {
      // プライベートモード等で sessionStorage が使えない場合は諦める。
      // 招待が無かった場合と同じ挙動になるだけで、アプリは通常どおり動く。
    }
  }

  // アドレスバーから /join/xxx を消す。リロードやブックマークで
  // 同じコードを再消費しないようにするため。
  window.history.replaceState(null, '', '/')
}

/** 退避された招待コードを取り出して消す。 */
function takePendingInvite(): string | null {
  try {
    const code = window.sessionStorage.getItem(PENDING_INVITE_KEY)
    if (code) window.sessionStorage.removeItem(PENDING_INVITE_KEY)
    return code
  } catch {
    return null
  }
}

/**
 * 認証済みになったら、退避された招待コードでチームに参加する。
 * 認証後に描画される場所（MainLayout）から呼ぶ。
 *
 * @param userId ログイン中のユーザー ID。未確定の間は undefined。
 * @param onJoined 参加に成功したあとに呼ぶ（所属チームの再取得など）。
 */
export function useRedeemPendingInvite(
  userId: string | undefined,
  onJoined: () => Promise<void> | void,
) {
  const toast = useToast()
  // StrictMode の二重実行や再描画で二重に消費しないための番人。
  const redeemingRef = useRef(false)

  useEffect(() => {
    if (!userId || redeemingRef.current) return

    const code = takePendingInvite()
    if (!code) return

    redeemingRef.current = true
    void (async () => {
      const { error } = await supabase.rpc('join_team_by_code', { code })

      if (error) {
        // 参加できなくてもアプリは使えるので、通知だけしてそのまま通す。
        toast({
          status: 'error',
          title: '招待リンクからの参加に失敗しました',
          description: error.message,
        })
        return
      }

      toast({ status: 'success', title: 'チームに参加しました' })
      await onJoined()
    })()
  }, [userId, onJoined, toast])
}
