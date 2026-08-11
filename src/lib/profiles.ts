import { supabase } from './supabase'

/**
 * 他人の表示名を引くための共通処理。
 *
 * users テーブルは「自分の行のみ」しか直接 SELECT できない（0018）。
 * メールアドレス・電話番号・生年月日を他人に見せないためで、
 * 他人の表示名は公開情報だけを返す RPC 経由で取得する。
 */

/** 指定した ID の表示名を引く。userId -> displayName のマップを返す。 */
export async function fetchPublicProfiles(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids)).filter(Boolean)
  if (unique.length === 0) return new Map()

  const { data, error } = await supabase.rpc('get_public_profiles', { p_ids: unique })
  if (error) {
    console.error('get_public_profiles error', error)
    return new Map()
  }
  return new Map((data ?? []).map((r) => [r.id, r.display_name]))
}

export interface PublicProfile {
  id: string
  displayName: string
}

/**
 * 表示名の部分一致、またはメールアドレスの完全一致でユーザーを探す。
 * メールを部分一致にすると総当たりでアドレスを探れてしまうため、
 * サーバ側（search_users）で完全一致に限定している。
 */
export async function searchUsers(query: string): Promise<PublicProfile[]> {
  const { data, error } = await supabase.rpc('search_users', { p_query: query })
  if (error) {
    console.error('search_users error', error)
    return []
  }
  return (data ?? []).map((r) => ({ id: r.id, displayName: r.display_name }))
}
